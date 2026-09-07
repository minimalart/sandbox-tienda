import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { enqueueSaleForOrder } from '../modules/erp/outbox/enqueue-sale';
import { resolveSalesTrigger } from '../modules/erp/billing-deposito';

/**
 * Reconciliación del trigger de ventas ERP: si el pago se capturó ANTES de
 * que existiera la orden (el webhook de MP completa el carrito y captura en
 * la misma request, y el subscriber de `payment.captured` puede correr antes
 * del link payment_collection ↔ order), este subscriber encola la venta al
 * crearse la orden. Idempotente por `event_key` — si `payment.captured` ya
 * la encoló, acá no pasa nada.
 *
 * Con `sales_notify.trigger = 'fulfillment_created'` no hace nada (return
 * limpio, sin fila `skipped` — ver `erp-payment-captured.ts`).
 *
 * NUNCA lanza: un fallo acá no puede afectar la creación de la orden.
 */
export default async function erpOrderPlacedReconcileHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const service = container.resolve<ErpModuleService>(ERP_MODULE);
    const config = await service.getActiveConfig();
    if (!config) return;
    if (resolveSalesTrigger(config.settings) === 'fulfillment_created') return;

    const orderId = event.data.id;
    const eventKey = `sale_created:${config.provider}:${orderId}`;
    if (await service.findOutboxEventByKey(eventKey)) return;

    // ¿La orden ya tiene un pago capturado? Si no, la notificación llegará por
    // payment.captured cuando se cobre.
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: ['id', 'payment_collections.payments.id', 'payment_collections.payments.captured_at'],
      filters: { id: orderId },
    })) as {
      data: Array<{
        payment_collections?: Array<{
          payments?: Array<{ captured_at?: string | Date | null }> | null;
        }> | null;
      }>;
    };
    const hasCapturedPayment = (orders[0]?.payment_collections ?? []).some((pc) =>
      (pc.payments ?? []).some((payment) => Boolean(payment.captured_at))
    );
    if (!hasCapturedPayment) return;

    await enqueueSaleForOrder(container, { config, orderId, source: 'order.placed (reconcile)' });
  } catch (error) {
    logger.warn(
      `[erp] subscriber order.placed (reconcile) falló (no afecta la orden): ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
