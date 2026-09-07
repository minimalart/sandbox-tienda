import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { buildAndreaniTrackingUrl } from '../modules/andreani-fulfillment/utils/tracking-url';
import { sendWhatsappOrderNotification } from '../lib/whatsapp/send-order-notification';

/**
 * WhatsApp de seguimiento con tracking REAL. Escucha `andreani.ticket_generated`
 * ({ order_id, tracking_number }), que el workflow de generación de etiquetas
 * emite UNA sola vez (en la primera generación). Arma la URL pública de Andreani
 * y envía el template `order-tracking` (número + link).
 *
 * Best-effort: cualquier fallo se loguea y nunca se propaga (un problema de
 * notificación no debe afectar el flujo que emitió el evento).
 */
export default async function handleAndreaniTicketTrackingWhatsapp({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; tracking_number?: string }>) {
  const orderId = event.data?.order_id;
  const trackingNumber = event.data?.tracking_number ?? undefined;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const trackingUrl = buildAndreaniTrackingUrl(trackingNumber);
    await sendWhatsappOrderNotification(container, {
      orderId,
      template: 'order-tracking',
      extraData: {
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
      },
    });
  } catch (error) {
    logger.warn(
      `[Andreani WhatsApp] No se pudo enviar el seguimiento con tracking de la orden ${orderId}: ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'andreani.ticket_generated',
};
