import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { sendOrderTrackingEmail } from '../modules/email/order-tracking-context';

/**
 * El mail de "en camino" de la flota propia.
 *
 * Hermano de `own-fleet-delivery-whatsapp.ts`: mismo evento
 * (`delivery.own_fleet_out_for_delivery`, con `{ order_id, driver_id,
 * vehicle_id }`), misma plantilla, otro canal.
 *
 * Sin tracking number ni URL a propósito: un reparto propio no tiene número de
 * seguimiento de carrier, y la plantilla no los exige. El cliente igual recibe
 * el hito "Enviado" con su línea de tiempo.
 */
export default async function handleOwnFleetDeliveryEmail({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; driver_id?: string; vehicle_id?: string }>) {
  const orderId = event.data?.order_id;
  if (!orderId) return;

  await sendOrderTrackingEmail(container, {
    orderId,
    milestone: 'shipped',
    source: 'own-fleet-delivery-email',
  });
}

export const config: SubscriberConfig = {
  event: 'delivery.own_fleet_out_for_delivery',
};
