import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  INotificationModuleService,
  Logger,
  MedusaContainer,
} from '@medusajs/framework/types';

type OrderGraphResult = {
  id: string;
  display_id?: number | null;
  email?: string | null;
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
 * Fuente única del envío de notificaciones de WhatsApp asociadas a una orden.
 * Hace el lookup de la orden + resolución de teléfono + `createNotifications`,
 * y arma el `data` base (customer_name, display_id, total, currency_code,
 * order_date, shipping_method_name, customer_email).
 *
 * `template` es el template de notificación de Medusa (ver
 * kapso-whatsapp/templates/index.ts). `extraData` son los campos específicos
 * del evento (tracking, driver, etc.) que se mergean en `data`; los `undefined`
 * los descarta el builder del template.
 *
 * Best-effort: cualquier fallo se loguea y NUNCA se propaga (un problema de
 * notificación no debe afectar el flujo que la disparó).
 */
export async function sendWhatsappOrderNotification(
  container: MedusaContainer,
  {
    orderId,
    template,
    extraData,
  }: {
    orderId: string;
    template: string;
    extraData?: Record<string, unknown>;
  }
): Promise<void> {
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);

  let order: OrderGraphResult | undefined;
  try {
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: [
        'id',
        'display_id',
        'email',
        'total',
        'currency_code',
        'created_at',
        // La tienda de la orden. El provider de Kapso resuelve sus credenciales
        // desde acá: sin este campo el WhatsApp sale del número global aunque la
        // tienda tenga el suyo configurado, y el cliente recibe un mensaje de una
        // marca que no reconoce.
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
    order = orders[0];
  } catch (error) {
    logger.warn(
      `[Order WhatsApp] No se pudieron leer los datos de la orden ${orderId}: ${(error as Error).message}`,
    );
    return;
  }

  if (!order) return;

  const phone =
    order.customer?.phone ?? order.shipping_address?.phone ?? order.billing_address?.phone ?? undefined;

  if (!phone) {
    logger.info(`[Order WhatsApp] Orden ${order.id} sin teléfono — se omite ${template}.`);
    return;
  }

  const customerName =
    fullName(order.customer?.first_name, order.customer?.last_name) ||
    fullName(order.shipping_address?.first_name, order.shipping_address?.last_name);

  try {
    await notificationService.createNotifications({
      to: phone,
      channel: 'whatsapp',
      template,
      data: {
        sales_channel_id: order.sales_channel_id ?? undefined,
        customer_name: customerName || undefined,
        display_id: order.display_id ?? undefined,
        total: formatMoney(order.total),
        currency_code: order.currency_code?.toUpperCase() ?? undefined,
        order_date: formatOrderDate(order.created_at),
        shipping_method_name: order.shipping_methods?.[0]?.name ?? undefined,
        customer_email: order.email ?? undefined,
        ...extraData,
      },
    });
  } catch (error) {
    logger.warn(
      `[Order WhatsApp] ${template} no enviado a ${phone} (orden ${order.id}): ${(error as Error).message}`,
    );
  }
}
