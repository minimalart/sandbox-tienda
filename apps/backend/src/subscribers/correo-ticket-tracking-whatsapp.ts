import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { buildCorreoTrackingUrl } from '../modules/correo-argentino-fulfillment/utils/tracking-url';
import { extractErrorMessage } from '../modules/correo-argentino-fulfillment/utils/errors';
import { sendWhatsappOrderNotification } from '../lib/whatsapp/send-order-notification';

/**
 * WhatsApp de seguimiento con el tracking REAL de Correo Argentino.
 *
 * Escucha `correo.ticket_generated` ({ order_id, tracking_number }), que el
 * workflow emite UNA sola vez — en la primera generación, no en los reintentos
 * idempotentes. Ese guard vive en el step, leyendo `existing_tickets` antes de
 * acumular: acá no hay que volver a chequearlo.
 *
 * Best-effort: cualquier fallo se loguea y NUNCA se propaga. Un problema de
 * notificación no puede afectar al flujo que ya creó un envío facturable.
 */
export default async function handleCorreoTicketTrackingWhatsapp({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; tracking_number?: string }>) {
  const orderId = event.data?.order_id;
  const trackingNumber = event.data?.tracking_number ?? undefined;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    await sendWhatsappOrderNotification(container, {
      orderId,
      template: 'order-tracking',
      extraData: {
        tracking_number: trackingNumber,
        tracking_url: buildCorreoTrackingUrl(trackingNumber),
      },
    });
  } catch (error) {
    logger.warn(
      `[Correo WhatsApp] No se pudo enviar el seguimiento de la orden ${orderId}: ${extractErrorMessage(error)}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'correo.ticket_generated',
};
