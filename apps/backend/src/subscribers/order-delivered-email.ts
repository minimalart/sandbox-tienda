import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { sendOrderTrackingEmail } from '../modules/email/order-tracking-context';

/**
 * El mail de "entregado".
 *
 * ── LA TRAMPA DEL PAYLOAD ───────────────────────────────────────────────────
 *
 * `delivery.created` lo emite `markOrderFulfillmentAsDeliveredWorkflow` de
 * Medusa con `{ id, no_notification }`, y ese `id` es el del **FULFILLMENT**, no
 * el de la orden. Tomarlo como `order_id` no rompe nada visible: la consulta no
 * encuentra la orden, el helper loguea un warning y el mail simplemente no sale
 * — otra vez el modo de falla silencioso que este ticket vino a cerrar. Por eso
 * se resuelve la orden desde el fulfillment antes de mandar nada.
 *
 * Sirve para envío y para retiro en tienda: el operador que entrega en el
 * mostrador marca el mismo fulfillment, así que el comprador que retiró también
 * recibe su "entregado".
 *
 * Nunca propaga: el event bus corre con `concurrency: 1` y un subscriber que
 * lanza congela la cola de notificaciones de toda la instalación.
 */
export default async function handleOrderDeliveredEmail({
  event,
  container,
}: SubscriberArgs<{ id?: string; no_notification?: boolean }>) {
  const fulfillmentId = event.data?.id;
  if (!fulfillmentId) return;

  // Medusa lo pone cuando el operador pide explícitamente no avisar al cliente.
  if (event.data?.no_notification) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: fulfillments } = (await query.graph({
      entity: 'fulfillment',
      fields: ['id', 'order.id'],
      filters: { id: fulfillmentId },
    })) as { data: Array<{ id: string; order?: { id?: string } | null }> };

    const orderId = fulfillments?.[0]?.order?.id;
    if (!orderId) {
      logger.warn(
        `[order-delivered-email] El fulfillment ${fulfillmentId} no resolvió una orden — no se manda el mail.`,
      );
      return;
    }

    await sendOrderTrackingEmail(container, {
      orderId,
      milestone: 'delivered',
      source: 'order-delivered-email',
    });
  } catch (error) {
    logger.warn(
      `[order-delivered-email] No se pudo avisar la entrega del fulfillment ${fulfillmentId}: ${
        (error as Error).message
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'delivery.created',
};
