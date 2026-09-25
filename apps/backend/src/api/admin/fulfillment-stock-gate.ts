import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import type { IInventoryService, Logger } from '@medusajs/framework/types';
import {
  type OrderLineForStock,
  type ReservationForStock,
  describeShortfalls,
  findStockShortfalls,
  planStockDemand,
} from '../../lib/shared/fulfillment-stock';

/**
 * Gate de `POST /admin/orders/:id/fulfillments`: no dejar el stock en negativo.
 *
 * El core aplica el descuento en la ubicación que eligió el operador
 * (`input.location_id ?? reservation.location_id`) y no valida disponibilidad
 * ahí. Despachar desde una sucursal distinta a la de la reserva deja el nivel en
 * negativo, sin error y sin log. La aritmética y el porqué están en
 * `lib/shared/fulfillment-stock.ts`.
 *
 * ── LO QUE ESTE GATE NO ES ───────────────────────────────────────────────────
 *
 * No es un control de "hay stock suficiente". Un pedido normal se despacha desde
 * la ubicación donde ya está reservado, y ahí el descuento y la liberación se
 * cancelan: no hace falta una sola unidad libre. Lo único que se rechaza es lo
 * que el movimiento saca de la disponibilidad de la ubicación y no está.
 *
 * Tampoco reemplaza a `erpFulfillmentGate`, que mira otra cosa (depósito
 * facturador y cobertura total de la orden) y sólo existe cuando el ERP factura
 * por fulfillment. Este corre antes y vale para cualquier instalación.
 *
 * ── EL MODO DE FALLO, QUE ES UNA DECISIÓN ────────────────────────────────────
 *
 * Ante un error INESPERADO (base caída, consulta mal formada) se DEJA PASAR y se
 * loguea, igual que el gate del ERP: trabar el despacho del depósito por un
 * problema nuestro es peor que la corrección que aporta el chequeo. Los rechazos
 * intencionales sí viajan al operador: breves, con la ubicación y qué hacer. El
 * detalle por producto (faltan / disponible) queda en el log.
 *
 * No-op cuando el body no trae `location_id`: sin ubicación elegida el core usa
 * la de cada reserva, que es exactamente el caso que nunca deja negativo.
 */
export async function fulfillmentStockGate(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = (req.params as Record<string, string | undefined>)?.id ?? null;

  try {
    const body = (req.body ?? {}) as { location_id?: unknown; items?: unknown };
    const locationId = typeof body.location_id === 'string' ? body.location_id : null;
    if (!locationId || !orderId) return next();

    const requested = Array.isArray(body.items)
      ? (body.items as Array<{ id?: unknown; quantity?: unknown }>).map((item) => ({
          id: typeof item?.id === 'string' ? item.id : '',
          quantity: typeof item?.quantity === 'number' ? item.quantity : null,
        }))
      : [];
    if (requested.length === 0) return next();

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    // `manage_inventory` y `allow_backorder` se piden EXPLÍCITAMENTE: sin ellos
    // el módulo puro saltea la línea, así que olvidarlos no rompe nada — deja el
    // gate mudo, que es el peor resultado posible. Si esta lista cambia, mirar
    // primero `participatesInStockCheck`.
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: [
        'id',
        'items.id',
        'items.title',
        'items.variant.manage_inventory',
        'items.variant.allow_backorder',
        'items.variant.inventory_items.inventory_item_id',
        'items.variant.inventory_items.required_quantity',
      ],
      filters: { id: orderId },
    })) as { data: Array<{ id: string; items?: OrderLineForStock[] | null }> };

    const lines = orders[0]?.items ?? [];
    if (lines.length === 0) return next(); // que el 404 lo tire el core

    const inventory = req.scope.resolve<IInventoryService>(Modules.INVENTORY);
    const reservations = (await inventory.listReservationItems({
      line_item_id: lines.map((line) => line.id),
    })) as ReservationForStock[];

    const demands = planStockDemand(lines, requested, reservations, locationId);
    if (demands.length === 0) return next();

    const availableByItem = new Map<string, number>();
    for (const demand of demands) {
      try {
        const available = await inventory.retrieveAvailableQuantity(demand.inventory_item_id, [
          locationId,
        ]);
        availableByItem.set(demand.inventory_item_id, Number(available));
      } catch (error) {
        // No saber cuánto hay no es lo mismo que saber que no hay. Se saltea ese
        // item (fail-open) en vez de rechazar por una lectura que falló.
        logger.warn(
          `[fulfillment] no se pudo leer la disponibilidad de ${demand.inventory_item_id} en ${locationId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const shortfalls = findStockShortfalls(
      demands.filter((demand) => availableByItem.has(demand.inventory_item_id)),
      availableByItem,
    );
    if (shortfalls.length === 0) return next();

    const [locationName, erpName] = await Promise.all([
      resolveLocationName(req, locationId),
      resolveErpName(req),
    ]);
    logger.warn(
      `[fulfillment] rechazado el despacho de la orden ${orderId} desde ${locationName ?? locationId}: ` +
        shortfalls
          .map(
            (s) =>
              `${s.titles.join(', ') || s.inventory_item_id} faltan ${s.missing} (disponible ${s.available})`,
          )
          .join('; '),
    );

    throw new MedusaError(MedusaError.Types.INVALID_DATA, describeShortfalls(locationName, erpName));
  } catch (error) {
    if (error instanceof MedusaError) return next(error);
    logger.error(
      `[fulfillment] el control de stock falló para la orden ${orderId ?? '?'} y se deja pasar: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return next();
  }
}

/** El operador lee nombres de sucursal, no ids. */
async function resolveLocationName(
  req: MedusaRequest,
  stockLocationId: string,
): Promise<string | null> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = (await query.graph({
      entity: 'stock_location',
      fields: ['id', 'name'],
      filters: { id: stockLocationId },
    })) as { data: Array<{ name?: string | null }> };
    return data[0]?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Nombres de los ERP que se muestran al operador, por `erp_config.provider`.
 * Un provider sin entrada cae a "el ERP" antes que mostrar el id crudo.
 */
const ERP_DISPLAY_NAMES: Record<string, string> = { zeus: 'Zeus' };

/**
 * Dónde se transfiere la mercadería, o `null` sin ERP activo.
 *
 * Se resuelve por la key del contenedor y no importando el módulo: este gate es
 * de core y el ERP es una extensión opcional (`optionalModule('erp','erp')`).
 */
async function resolveErpName(req: MedusaRequest): Promise<string | null> {
  try {
    const erp = req.scope.resolve<{
      getActiveConfig: () => Promise<{ provider?: string | null } | null>;
    }>('erp');
    const provider = (await erp.getActiveConfig())?.provider;
    if (!provider) return null;
    return ERP_DISPLAY_NAMES[provider] ?? 'el ERP';
  } catch {
    return null;
  }
}
