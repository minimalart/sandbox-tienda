import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { buildAndreaniTrackingUrl } from '../modules/andreani-fulfillment/utils/tracking-url';
import { sendOrderTrackingEmail } from '../modules/email/order-tracking-context';

/**
 * El mail de "en camino" con el tracking de Andreani.
 *
 * Hermano de `andreani-ticket-tracking-whatsapp.ts`: mismo evento, misma
 * plantilla (`order-tracking`), otro canal. Vive en la extensión de Andreani —y
 * no en un subscriber del núcleo que escuche los cuatro eventos de envío—
 * porque la URL pública sale de `modules/andreani-fulfillment`, que es opcional:
 * un archivo del núcleo que la importe rompe el build de todo proyecto generado
 * sin Andreani.
 *
 * `andreani.ticket_generated` se emite UNA sola vez, en la primera generación de
 * la etiqueta, así que no hace falta un gate de idempotencia acá.
 */
export default async function handleAndreaniTicketTrackingEmail({
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
    trackingUrl: buildAndreaniTrackingUrl(trackingNumber),
    source: 'andreani-tracking-email',
  });
}

export const config: SubscriberConfig = {
  event: 'andreani.ticket_generated',
};
