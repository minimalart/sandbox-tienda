import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../modules/erp';
import type ErpModuleService from '../../../modules/erp/service';
import {
  activeDepositoMappings,
  resolveBillingDeposito,
  resolveSalesTrigger,
} from '../../../modules/erp/billing-deposito';
import {
  findUncoveredItems,
  type CoverageOrderItem,
  type CoverageRequestedItem,
} from '../../../modules/erp/fulfillment-coverage';
import type { ErpBillingConfirmation } from '../../../modules/erp/types';

/**
 * Gate de `POST /admin/orders/:id/fulfillments` cuando el ERP factura al crear
 * el fulfillment.
 *
 * Hace dos cosas, y la segunda es la importante:
 *
 * 1. VALIDA que el despacho sea facturable: que salga de la stock location del
 *    depósito facturador y que cubra la orden COMPLETA (el ERP emite una sola
 *    factura por orden; un parcial la partiría en dos, o peor, facturaría de
 *    menos).
 *
 * 2. MARCA la orden con `metadata.erp_billing` — el registro auditable de qué
 *    depósito confirmó una persona. Es lo único que distingue este fulfillment
 *    de los que crean solos `andreani-order.ts` / `correo-order.ts` /
 *    `own-fleet-order.ts` sobre `order.placed`/`payment.captured` (sin
 *    `location_id`, encima). Sin la marca, `erp-fulfillment-created.ts` no
 *    factura.
 *
 * La marca va en la ORDEN y no en el fulfillment a propósito: no depende de que
 * Medusa persista el `metadata` del body de esta ruta, y sobrevive para que el
 * widget del admin pueda mostrar qué se confirmó y cuándo.
 *
 * No-op total si el ERP está apagado, si la notificación de ventas está apagada
 * o si el trigger es `payment_captured`. Ninguna instalación existente cambia de
 * comportamiento por este middleware.
 */

export async function erpFulfillmentGate(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  let service: ErpModuleService;
  try {
    service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  } catch {
    // El módulo ERP es opcional (`optionalModule('erp','erp')`): sin él, el gate
    // no existe.
    return next();
  }

  let orderId: string | null = null;
  try {
    const config = await service.getActiveConfig();
    if (!config || !config.sales_notify_enabled) return next();
    if (resolveSalesTrigger(config.settings) !== 'fulfillment_created') return next();

    orderId = (req.params as Record<string, string | undefined>)?.id ?? null;
    if (!orderId) return next();

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: [
        'id',
        'metadata',
        'items.id',
        'items.quantity',
        'items.detail.quantity',
        'items.detail.fulfilled_quantity',
      ],
      filters: { id: orderId },
    })) as {
      data: Array<{
        id: string;
        metadata?: Record<string, unknown> | null;
        items?: CoverageOrderItem[] | null;
      }>;
    };
    const order = orders[0];
    if (!order) return next(); // que el 404 lo tire el core

    // 1) Depósito facturador resoluble y mapeado.
    const resolution = resolveBillingDeposito(config.settings, order.metadata ?? null);
    if (!resolution.ok) {
      const mapped = activeDepositoMappings(config.settings)
        .map((row) => row.deposito)
        .join(', ');
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        resolution.reason === 'not_configured'
          ? 'El ERP factura al crear el fulfillment, pero no hay depósito facturador elegido. Configuralo en ERP → Configuración.'
          : `El depósito facturador "${resolution.deposito}" no está mapeado a ninguna stock location${
              mapped ? ` (mapeados: ${mapped})` : ''
            }. Revisá ERP → Configuración.`
      );
    }

    // 2) El fulfillment tiene que salir de ESA stock location.
    const body = (req.body ?? {}) as { location_id?: unknown; items?: unknown };
    const locationId = typeof body.location_id === 'string' ? body.location_id : null;
    if (!locationId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Elegí la ubicación de despacho: el ERP factura desde el depósito "${resolution.deposito}" y necesita saber que la mercadería salió de ahí.`
      );
    }
    if (locationId !== resolution.stock_location_id) {
      const locationName = await resolveLocationName(req, resolution.stock_location_id);
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Este pedido se factura desde el depósito "${resolution.deposito}"${
          locationName ? ` (${locationName})` : ''
        }. Consolidá la mercadería ahí en el ERP y creá el fulfillment desde esa ubicación.`
      );
    }

    // 3) Cobertura total: una orden, una factura.
    const requested = Array.isArray(body.items) ? (body.items as CoverageRequestedItem[]) : [];
    const gaps = findUncoveredItems(order.items ?? [], requested);
    if (gaps.length > 0) {
      const detail = gaps
        .map((gap) => `${gap.id} (pendiente ${gap.pending}, incluido ${gap.requested})`)
        .join('; ');
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El ERP emite UNA factura por pedido, así que el fulfillment tiene que cubrir todo lo pendiente. Falta: ${detail}.`
      );
    }

    // 4) Marca de confirmación humana. Si esto falla, se RECHAZA el request:
    // mejor que el operador reintente que facturar sin registro de qué depósito
    // se confirmó.
    const confirmation: ErpBillingConfirmation = {
      deposito: resolution.deposito,
      stock_location_id: resolution.stock_location_id,
      confirmed_at: new Date().toISOString(),
      confirmed_by:
        (req as unknown as { auth_context?: { actor_id?: string | null } }).auth_context?.actor_id ??
        null,
    };
    const orderService = req.scope.resolve(Modules.ORDER);
    await orderService.updateOrders([
      {
        id: order.id,
        metadata: { ...(order.metadata ?? {}), erp_billing: confirmation },
      },
    ]);

    logger.info(
      `[erp] fulfillment de la orden ${order.id} confirmado desde el depósito ${resolution.deposito} (${resolution.source}); se facturará al crearse.`
    );
    return next();
  } catch (error) {
    // Los rechazos del gate son intencionales y viajan al operador.
    if (error instanceof MedusaError) return next(error);
    // Cualquier otra cosa (base caída, query mal formada) NO puede trabar el
    // despacho: se loguea y se deja pasar. El costo es que esa orden no se
    // factura sola —queda visible sin comprobante en el widget de la orden—, y
    // eso es preferible a bloquear la operación del depósito.
    logger.error(
      `[erp] el gate de fulfillment falló para la orden ${orderId ?? '?'} y se deja pasar sin marcar: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return next();
  }
}

/** Nombre de la stock location para el mensaje de error (el operador ve nombres, no ids). */
async function resolveLocationName(req: MedusaRequest, stockLocationId: string): Promise<string | null> {
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
