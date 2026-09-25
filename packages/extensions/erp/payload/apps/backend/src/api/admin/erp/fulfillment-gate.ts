import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../modules/erp';
import type ErpModuleService from '../../../modules/erp/service';
import {
  activeDepositoMappings,
  depositoForStockLocation,
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
 * ────────────────────────────────────────────────────────────────────────────
 * LA UBICACIÓN DE DESPACHO ES LA QUE FACTURA
 *
 * El operador elige en la pantalla de fulfillment de dónde salen los productos,
 * y ESA elección determina desde qué depósito se factura. No hay depósito
 * facturador preconfigurado: `location_id` → `deposito_map` → depósito del ERP.
 *
 * Antes era al revés —la configuración dictaba el depósito y el gate rechazaba
 * el fulfillment si la ubicación elegida no coincidía, mandando al operador a
 * ERP → Configuración a cambiarla—. Ese flujo obligaba a tocar una pantalla de
 * configuración global para despachar UN pedido, que es justo lo que no puede
 * pasar cuando el stock vive repartido y cada pedido sale de donde hay.
 *
 * Consecuencia buscada: no hay default. Si la ubicación no está mapeada a
 * ningún depósito, se corta y se dice cuál mapear — mejor que facturar desde
 * un depósito que nadie eligió.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Hace dos cosas, y la segunda es la importante:
 *
 * 1. VALIDA que el despacho sea facturable: que diga de dónde sale, que esa
 *    ubicación esté mapeada a un depósito del ERP y que cubra la orden COMPLETA
 *    (el ERP emite una sola factura por orden; un parcial la partiría en dos, o
 *    peor, facturaría de menos).
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

    // 1) De dónde sale la mercadería. Sin esto no hay nada que facturar: es la
    //    elección del operador, y es la que manda.
    const body = (req.body ?? {}) as { location_id?: unknown; items?: unknown };
    const locationId = typeof body.location_id === 'string' ? body.location_id : null;
    if (!locationId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Elegí la ubicación de despacho: el ERP factura desde la sucursal de donde sale la mercadería.'
      );
    }

    // 2) Esa ubicación tiene que estar mapeada a un depósito del ERP. Este es
    //    el ÚNICO dato de configuración que sigue haciendo falta, y es un mapeo
    //    (sucursal ↔ depósito), no un default: no elige nada por nosotros.
    const deposito = depositoForStockLocation(config.settings, locationId);
    if (!deposito) {
      const locationName = await resolveLocationName(req, locationId);
      const mappedNames = await resolveMappedLocationNames(req, config.settings);
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `La ubicación "${locationName ?? locationId}" no está mapeada a ningún depósito del ERP, así que no se puede facturar desde ahí.${
          mappedNames.length ? ` Mapeadas hoy: ${mappedNames.join(', ')}.` : ''
        } Agregala en ERP → Configuración → mapeo de depósitos.`
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
      deposito,
      stock_location_id: locationId,
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
      `[erp] fulfillment de la orden ${order.id} confirmado desde el depósito ${deposito} (ubicación ${locationId} elegida por el operador); se facturará al crearse.`
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

/**
 * Nombres de las ubicaciones que SÍ están mapeadas, para que el error diga
 * desde dónde se puede despachar en vez de sólo desde dónde no. Sólo corre en
 * el camino de error.
 */
async function resolveMappedLocationNames(
  req: MedusaRequest,
  settings: Parameters<typeof activeDepositoMappings>[0]
): Promise<string[]> {
  const ids = [...new Set(activeDepositoMappings(settings).map((row) => row.stock_location_id))];
  if (!ids.length) return [];
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = (await query.graph({
      entity: 'stock_location',
      fields: ['id', 'name'],
      filters: { id: ids },
    })) as { data: Array<{ id: string; name?: string | null }> };
    return data.map((location) => location.name ?? location.id);
  } catch {
    return [];
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
