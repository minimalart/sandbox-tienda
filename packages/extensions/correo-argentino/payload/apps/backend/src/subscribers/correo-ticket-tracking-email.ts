import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { buildCorreoTrackingUrl } from '../modules/correo-argentino-fulfillment/utils/tracking-url';
import { sendOrderTrackingEmail } from '../modules/email/order-tracking-context';

/**
 * El mail de "en camino" con el tracking de Correo Argentino.
 *
 * Hermano de `correo-ticket-tracking-whatsapp.ts`: mismo evento, misma plantilla
 * (`order-tracking`), otro canal. Vive en la extensión de Correo por el mismo
 * motivo que el de Andreani: la URL pública sale de un módulo opcional.
 *
 * El evento se emite una sola vez —el guard vive en el step, que lee
 * `existing_tickets` antes de acumular—, así que acá no hay que rechequearlo.
 */
export default async function handleCorreoTicketTrackingEmail({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; tracking_number?: string }>) {
  const orderId = event.data?.order_id;
  if (!orderId) return;

  const trackingNumber = event.data?.tracking_number ?? undefined;

  await sendOrderTrackingEmail(container, {
    orderId,
    milestone: 'shipped',
    trackingNumber,
    trackingUrl: buildCorreoTrackingUrl(trackingNumber),
    source: 'correo-tracking-email',
  });
}

export const config: SubscriberConfig = {
  event: 'correo.ticket_generated',
};
