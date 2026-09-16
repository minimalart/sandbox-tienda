import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { markOrderReadyForPickup } from '../workflows/mark-order-ready-for-pickup';

/**
 * La SEGUNDA puerta del aviso "listo para retirar": el operador movió la
 * ejecución de entrega a `at_pickup_point` desde la pantalla de delivery en vez
 * de usar el botón de la orden.
 *
 * Llama a la MISMA función que el botón, así que el gate de idempotencia
 * (`order.metadata.ready_for_pickup_at`) es el mismo y una orden marcada por las
 * dos vías sigue recibiendo un solo mail.
 *
 * Nunca propaga: el event bus corre con concurrency 1 y un subscriber que lanza
 * congela la cola entera de notificaciones hasta el próximo restart.
 */
export default async function handleStorePickupReadyEmail({
  event,
  container,
}: SubscriberArgs<{ order_id?: string }>) {
  const orderId = event.data?.order_id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const result = await markOrderReadyForPickup(container, {
      orderId,
      source: 'delivery-transition',
    });
    if (result.status === 'already_sent') {
      logger.info(
        `[ready-for-pickup] La orden ${orderId} ya se había marcado desde el admin — la transición de delivery no reenvía.`,
      );
    }
  } catch (error) {
    logger.warn(
      `[ready-for-pickup] No se pudo avisar el retiro de la orden ${orderId}: ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'delivery.store_pickup_ready',
};
