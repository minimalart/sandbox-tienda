import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';

type OrderRow = {
  id: string;
  display_id?: number | null;
  email: string | null;
  sales_channel_id?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  items?: { id: string }[] | null;
};

/**
 * Confirmación por email al cliente cuando solicita una devolución
 * (evento `order.return_requested`, data `{ order_id, return_id }`). Best-effort:
 * cualquier fallo se loguea y nunca se propaga. La confirmación por WhatsApp del
 * bot ocurre en el mismo chat al crear el return (dentro de la ventana de 24h).
 */
export default async function handleReturnRequested({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; return_id?: string }>) {
  const orderId = event.data?.order_id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);

  try {
    const { data: orders } = (await query.graph({
      entity: 'order',
      // `sales_channel_id`: el provider de email resuelve con esto la marca del mail.
      fields: [
        'id',
        'display_id',
        'email',
        'sales_channel_id',
        'customer.first_name',
        'customer.last_name',
        'items.id',
      ],
      filters: { id: orderId },
    })) as { data: OrderRow[] };
    const order = orders?.[0];
    if (!order?.email) return;

    const name = [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    await notificationService.createNotifications({
      to: order.email,
      channel: 'email',
      template: 'return-requested',
      data: {
        sales_channel_id: order.sales_channel_id ?? undefined,
        display_id: order.display_id ?? undefined,
        customer_name: name || undefined,
        item_count: order.items?.length ?? undefined,
      },
    });
  } catch (error) {
    logger.warn(
      `[Return] No se pudo notificar la devolución de la orden ${orderId}: ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.return_requested',
};
