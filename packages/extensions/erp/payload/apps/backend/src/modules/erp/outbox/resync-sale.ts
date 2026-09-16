import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { ErpConfigRow } from '../service';
import { getErpAdapter } from '../adapters/registry';
import { getCountryLayer } from '../countries/registry';
import { truncateError } from '../sanitize';
import { buildSalePayload } from './build-sale-payload';
import { decideResync, type ResyncNoopReason, type ResyncRequeueReason } from './resync-decision';

/**
 * Reenvío MANUAL de una venta al ERP: rearma el payload desde la orden y deja
 * la fila del outbox en `pending` para que el processor la tome.
 *
 * No es `enqueueSaleForOrder` con otro nombre. Ese es idempotente a propósito
 * (corta ante cualquier fila con el mismo `event_key`) porque lo llaman
 * subscribers que pueden disparar varias veces por la misma venta. Esto es lo
 * contrario: lo llama una persona que ya vio el estado en el panel y quiere que
 * la venta salga igual.
 *
 * El payload se REARMA, nunca se reusa el guardado, y eso es lo que hace que
 * funcione sobre un `skipped`: la fila salteada guarda
 * `{ reason: 'sales_notify_disabled' }`, no una venta. Rearmar también arregla
 * el caso de un `dead_letter` que falló por datos (un ítem sin SKU, un depósito
 * mal mapeado) y que alguien corrigió en la orden desde entonces.
 */

export type ResyncSaleResult =
  | { order_id: string; ok: true; event_id: string; reason: ResyncRequeueReason }
  | { order_id: string; ok: false; reason: ResyncNoopReason | ResyncErrorReason; error?: string };

export type ResyncErrorReason =
  /** La orden no existe (o no se pudo armar su payload). */
  | 'order_not_found'
  /** El provider activo no sabe notificar ventas. */
  | 'provider_cannot_notify'
  /** La notificación de ventas está apagada en la config. */
  | 'sales_notify_disabled'
  /** Cualquier otro error al rearmar o guardar. */
  | 'error';

/**
 * Reencola UNA venta. `force` habilita `sent`/`duplicate` — ver el porqué en
 * `resync-decision.ts`: no todos los ERP deduplican y reenviar puede refacturar.
 */
export async function resyncSaleForOrder(
  container: MedusaContainer,
  opts: {
    config: ErpConfigRow;
    orderId: string;
    force?: boolean;
    /** Override del depósito facturador; ausente = el de la config. */
    billingDeposito?: string | null;
  }
): Promise<ResyncSaleResult> {
  const { config, orderId, force = false, billingDeposito } = opts;
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  // El gate va ANTES de rearmar: sin notificación habilitada el processor no
  // toma ni un `pending` (`processOutboxBatch` sale temprano), así que dejar la
  // fila en `pending` sería mentirle al operador — vería "reencolada" y no
  // saldría nunca. Que lo prenda primero.
  if (!config.sales_notify_enabled) {
    return { order_id: orderId, ok: false, reason: 'sales_notify_disabled' };
  }
  if (!getErpAdapter(config.provider).getCapabilities().sale_notify) {
    return { order_id: orderId, ok: false, reason: 'provider_cannot_notify' };
  }

  const eventKey = `sale_created:${config.provider}:${orderId}`;
  const existing = await service.findOutboxEventByKey(eventKey);
  const decision = decideResync({ status: existing?.status ?? null, force });
  if (decision.action === 'noop') {
    return { order_id: orderId, ok: false, reason: decision.reason };
  }

  try {
    const payload = await buildSalePayload(container, {
      orderId,
      eventKey,
      country: getCountryLayer(config.country_code),
      billingDeposito: billingDeposito ?? null,
    });
    if (!payload) {
      return { order_id: orderId, ok: false, reason: 'order_not_found' };
    }

    // Fila nueva vs. fila existente. `enqueueOutboxEvent` no sirve para la
    // segunda: es idempotente y devolvería la fila vieja sin tocarla.
    const event = existing
      ? await service.resetOutboxEventForResync(existing.id, payload)
      : (
          await service.enqueueOutboxEvent({
            event_type: 'sale_created',
            event_key: eventKey,
            aggregate_type: 'order',
            aggregate_id: orderId,
            provider: config.provider,
            payload,
            status: 'pending',
          })
        ).event;

    logger.info(
      `[erp] venta ${eventKey} reencolada a mano (estado previo: ${existing?.status ?? 'sin fila'}${force ? ', forzado' : ''}).`
    );
    return { order_id: orderId, ok: true, event_id: event.id, reason: decision.reason };
  } catch (error) {
    logger.warn(
      `[erp] no se pudo reencolar la venta de la orden ${orderId}: ${truncateError(error, 300)}`
    );
    return {
      order_id: orderId,
      ok: false,
      reason: 'error',
      error: truncateError(error, 300),
    };
  }
}

/**
 * Reencola VARIAS ventas, una por una y sin cortar ante un fallo.
 *
 * Secuencial a propósito. Cada orden es un `buildSalePayload`, que son varias
 * consultas al grafo; en paralelo sobre 200 órdenes eso es una tormenta contra
 * la base para una acción de panel que nadie mira a los ojos. El techo lo pone
 * la ruta, no esto.
 */
export async function resyncSalesForOrders(
  container: MedusaContainer,
  opts: {
    config: ErpConfigRow;
    orderIds: string[];
    force?: boolean;
  }
): Promise<{ results: ResyncSaleResult[]; requeued: number }> {
  const results: ResyncSaleResult[] = [];
  for (const orderId of [...new Set(opts.orderIds)]) {
    results.push(
      await resyncSaleForOrder(container, {
        config: opts.config,
        orderId,
        force: opts.force,
      })
    );
  }
  return { results, requeued: results.filter((row) => row.ok).length };
}
