import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { asAddress, buildManageUrl, fullName } from '../modules/recurring-order/lib';
import { enqueueSubscriptionCommunication } from '../modules/recurring-order/communications';

type OrderGraph = {
  id: string;
  display_id?: number | null;
  cart_id?: string | null;
  sales_channel_id?: string | null;
};
type CartGraph = { id: string; metadata?: Record<string, unknown> | null };

/**
 * Cierra el ciclo de renovación cuando el cliente confirmó y pagó: el carrito
 * de renovación lleva `metadata.renewal_cycle_id`, así que al crearse la orden
 * marcamos el ciclo `success`, reactivamos la suscripción y agendamos el
 * próximo. Idempotente (converge por webhook de MP y por placeOrder del
 * storefront) y fire-and-forget: nunca propaga al event bus.
 */
export default async function handleRecurringOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (i: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);

  try {
    const { data: orders } = (await query.graph({
      entity: 'order',
      // `sales_channel_id`: con esto el mail sale con la marca de su tienda.
      fields: ['id', 'display_id', 'cart_id', 'sales_channel_id'],
      filters: { id: orderId },
    })) as { data: OrderGraph[] };
    const cartId = orders[0]?.cart_id;
    if (!cartId) return;

    const { data: carts } = (await query.graph({
      entity: 'cart',
      fields: ['id', 'metadata'],
      filters: { id: cartId },
    })) as { data: CartGraph[] };
    const cycleId = carts[0]?.metadata?.renewal_cycle_id as string | undefined;
    if (!cycleId) return;

    const closed = await service.markCycleSuccess(cycleId, orderId);
    if (!closed) return;
    logger.info(
      `[RecurringOrder] ciclo ${cycleId} cerrado por la orden ${orderId}.`,
    );

    // Aviso "orden generada" (best-effort).
    try {
      const cycle = await service.retrieveRenewalCycle(cycleId);
      const ro = await service.retrieveRecurringOrder(cycle.recurring_order_id);
      if (ro.plan_id) {
        await enqueueSubscriptionCommunication(
          container,
          ro,
          'recurring-order-generated',
          { order_display_id: orders[0]?.display_id ?? orderId },
          `recurring-order-generated:${cycle.id}`,
        );
        return;
      }
      if (ro.email) {
        const notificationService = container.resolve<INotificationModuleService>(
          Modules.NOTIFICATION,
        );
        await notificationService.createNotifications({
          to: ro.email,
          channel: 'email',
          template: 'recurring-order-generated',
          data: {
            sales_channel_id: orders[0]?.sales_channel_id ?? undefined,
            customer_name:
              fullName(
                asAddress(ro.shipping_address).first_name,
                asAddress(ro.shipping_address).last_name,
              ) || undefined,
            order_display_id: orders[0]?.display_id ?? undefined,
            next_execution: ro.next_execution_at
              ? new Date(ro.next_execution_at).toISOString()
              : undefined,
            manage_url: buildManageUrl(ro.country_code),
          },
        });
      }
    } catch (e) {
      logger.warn(
        `[RecurringOrder] notificación de orden generada falló: ${(e as Error).message}`,
      );
    }
  } catch (e) {
    logger.warn(
      `[RecurringOrder] no se pudo cerrar el ciclo para la orden ${orderId}: ${(e as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
