import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ABANDONED_CART_MODULE } from '../modules/abandoned-cart';
import type AbandonedCartModuleService from '../modules/abandoned-cart/service';

type OrderGraph = { id: string; cart_id?: string | null };

const CART_LINK_RETRIES = 5;
const CART_LINK_DELAY_MS = 500;

/**
 * Cuando una orden se crea, si su carrito estaba en seguimiento lo marca como
 * `recovered` para cortar la secuencia de recordatorios. Fire-and-forget: nunca
 * propaga al event bus.
 */
export default async function handleAbandonedCartRecovered({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (i: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const service = container.resolve<AbandonedCartModuleService>(ABANDONED_CART_MODULE);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const loadOrder = async (): Promise<OrderGraph | undefined> => {
    const { data } = (await query.graph({
      entity: 'order',
      fields: ['id', 'cart_id'],
      filters: { id: orderId },
    })) as { data: OrderGraph[] };
    return data[0];
  };

  try {
    // El link order → cart NO está commiteado cuando se emite `order.placed`: se
    // crea en un paso posterior de completeCartWorkflow. Sin este reintento
    // acotado el subscriber funciona en desarrollo y reporta CERO recuperados en
    // producción. Mismo patrón que `order-company-tag.ts` y `order-billing-snapshot.ts`.
    let order = await loadOrder();
    for (let attempt = 0; attempt < CART_LINK_RETRIES && !order?.cart_id; attempt++) {
      await sleep(CART_LINK_DELAY_MS);
      order = await loadOrder();
    }

    const cartId = order?.cart_id;
    if (!cartId) {
      // No es inocuo: el tracking queda abierto y la tasa de recuperación
      // subestimada. La fase de reconciliación del cron lo recoge después.
      logger.warn(
        `[AbandonedCart] la orden ${orderId} no resolvió cart_id tras ` +
          `${CART_LINK_RETRIES} intentos; queda para la reconciliación del cron.`,
      );
      return;
    }

    const recovered = await service.markRecoveredByCartId(cartId, orderId);
    if (recovered) {
      logger.info(`[AbandonedCart] carrito ${cartId} recuperado por orden ${orderId}.`);
    }
  } catch (e) {
    logger.warn(
      `[AbandonedCart] no se pudo marcar recuperado para la orden ${orderId}: ${(e as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
