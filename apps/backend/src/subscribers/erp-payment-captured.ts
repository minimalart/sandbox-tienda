import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { enqueueSaleForOrder } from '../modules/erp/outbox/enqueue-sale';
import { resolveSalesTrigger } from '../modules/erp/billing-deposito';

/**
 * Trigger elegido para notificar ventas al ERP: pago CAPTURADO (no
 * order.placed) — solo se notifican ventas cobradas. `payment.captured` lo
 * emite `capturePaymentWorkflow` (captura manual del admin, Stripe, y el
 * webhook de MercadoPago desde que usa el workflow).
 *
 * Resuelve payment → payment_collection → order (2 saltos, mismo camino que
 * el core) y encola en el outbox con clave idempotente por orden: capturas
 * múltiples/parciales no duplican la notificación. Si la captura llega antes
 * de que exista la orden (carrera de webhooks), lo cubre el subscriber de
 * reconciliación en `order.placed`.
 *
 * Con `sales_notify.trigger = 'fulfillment_created'` este subscriber NO encola:
 * la venta la encola `erp-fulfillment-created.ts`. El return es LIMPIO, sin
 * dejar fila `skipped`: `enqueueSaleForOrder` corta ante cualquier evento con el
 * mismo `event_key` (`sale_created:{provider}:{order_id}`), así que una fila
 * `skipped` acá dejaría esa orden sin facturar PARA SIEMPRE.
 *
 * NUNCA lanza: un fallo acá no puede afectar el flujo de pago/checkout.
 */
export default async function erpPaymentCapturedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const service = container.resolve<ErpModuleService>(ERP_MODULE);
    const config = await service.getActiveConfig();
    if (!config) return;

    // Ver el comentario de arriba: return limpio, nunca una fila `skipped`.
    if (resolveSalesTrigger(config.settings) === 'fulfillment_created') {
      logger.debug(
        '[erp] payment.captured ignorado: la venta se notifica al crear el fulfillment.'
      );
      return;
    }

    const paymentId = event.data.id;
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: payments } = (await query.graph({
      entity: 'payment',
      fields: ['id', 'payment_collection_id'],
      filters: { id: paymentId },
    })) as { data: Array<{ id: string; payment_collection_id: string | null }> };
    const paymentCollectionId = payments[0]?.payment_collection_id;
    if (!paymentCollectionId) {
      logger.warn(`[erp] payment.captured ${paymentId}: pago sin payment_collection; se ignora.`);
      return;
    }

    const { data: links } = (await query.graph({
      entity: 'order_payment_collection',
      fields: ['order_id'],
      filters: { payment_collection_id: paymentCollectionId },
    })) as { data: Array<{ order_id: string | null }> };
    const orderId = links[0]?.order_id;
    if (!orderId) {
      logger.warn(
        `[erp] payment.captured ${paymentId}: sin orden linkeada todavía; lo cubre la reconciliación de order.placed.`
      );
      return;
    }

    await enqueueSaleForOrder(container, { config, orderId, source: 'payment.captured' });
  } catch (error) {
    logger.warn(
      `[erp] subscriber payment.captured falló (no afecta el pago): ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const config: SubscriberConfig = {
  event: 'payment.captured',
};
