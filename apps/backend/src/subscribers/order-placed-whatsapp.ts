import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';

type OrderGraphResult = {
  id: string;
  display_id?: number | null;
  email: string | null;
  total?: number | null;
  currency_code?: string | null;
  created_at?: string | Date | null;
  sales_channel_id?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  shipping_address?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  billing_address?: { phone?: string | null } | null;
  shipping_methods?: { name?: string | null }[] | null;
};

function formatMoney(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatOrderDate(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/**
 * Envía la confirmación de pedido por WhatsApp (canal `whatsapp` → provider Kapso)
 * cuando hay un teléfono disponible. Desacoplado del subscriber de email: si no
 * hay teléfono o falla el envío, solo se loguea y nunca se propaga al event bus.
 */
export default async function handleOrderPlacedWhatsapp({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const loadOrder = async (): Promise<OrderGraphResult | undefined> => {
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: [
        'id',
        'display_id',
        'email',
        'total',
        'currency_code',
        'created_at',
        // La tienda de la orden: sin esto el WhatsApp sale del número global aunque la
        // tienda tenga el suyo, y el cliente recibe un mensaje de una marca que no
        // reconoce.
        'sales_channel_id',
        'customer.first_name',
        'customer.last_name',
        'customer.phone',
        'shipping_address.first_name',
        'shipping_address.last_name',
        'shipping_address.phone',
        'billing_address.phone',
        'shipping_methods.name',
      ],
      filters: { id: orderId },
    })) as { data: OrderGraphResult[] };
    return orders[0];
  };

  let order: OrderGraphResult | undefined;
  try {
    order = await loadOrder();
  } catch (error) {
    logger.warn(
      `[Order WhatsApp] No se pudieron leer los datos de la orden ${orderId}: ${(error as Error).message}`,
    );
    return;
  }

  if (!order) return;

  // En órdenes B2B el total de la orden puede no estar commiteado al emitirse
  // `order.placed` (se computa en un paso posterior de completeCartWorkflow):
  // el WhatsApp saldría con "Total $0". Reintentar hasta que aparezca el total.
  // Ver [[b2b-order-placed-subscribers-link-timing]].
  for (let attempt = 0; attempt < 5 && (Number(order.total) || 0) <= 0; attempt++) {
    await sleep(500);
    try {
      order = (await loadOrder()) ?? order;
    } catch {
      // Reintento efímero: si falla, seguimos con lo que teníamos.
    }
  }

  const phone =
    order.customer?.phone ?? order.shipping_address?.phone ?? order.billing_address?.phone ?? undefined;

  if (!phone) {
    logger.info(`[Order WhatsApp] Orden ${order.id} sin teléfono — se omite WhatsApp.`);
    return;
  }

  const customerName =
    fullName(order.customer?.first_name, order.customer?.last_name) ||
    fullName(order.shipping_address?.first_name, order.shipping_address?.last_name);

  try {
    await notificationService.createNotifications({
      to: phone,
      channel: 'whatsapp',
      template: 'order-confirmation',
      data: {
        sales_channel_id: order.sales_channel_id ?? undefined,
        customer_name: customerName || undefined,
        display_id: order.display_id ?? undefined,
        total: formatMoney(order.total),
        currency_code: order.currency_code?.toUpperCase() ?? undefined,
        order_date: formatOrderDate(order.created_at),
        shipping_method_name: order.shipping_methods?.[0]?.name ?? undefined,
        customer_email: order.email ?? undefined,
      },
    });
  } catch (error) {
    logger.warn(
      `[Order WhatsApp] order-confirmation no enviado a ${phone} (orden ${order.id}): ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
