import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';

type OrderAddress = {
  first_name?: string | null;
  last_name?: string | null;
} | null;

type OrderGraphResult = {
  id: string;
  display_id?: number | null;
  created_at?: string | Date | null;
  email?: string | null;
  sales_channel_id?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress;
};

function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/**
 * Fecha en es-AR ("16/6/26, 14:30"). Devuelve undefined —no cadena vacía— si la
 * fecha es inválida: la plantilla la envuelve en `{{#if order_date_formatted}}`,
 * así que con undefined el bloque entero no se pinta en vez de mostrar "Fecha: ".
 */
function formatOrderDate(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/**
 * El texto base del asunto. Vive en una constante porque viaja como la variable
 * `subject`, que la fila de la base PUEDE interpolar en su propio asunto.
 */
export const ORDER_CANCELLED_SUBJECT = 'Tu pedido fue cancelado';

/**
 * Arma el `data` de la notificación a partir de la orden.
 *
 * Se exporta para poder testear EL CONTRATO DE VARIABLES sin levantar el
 * contenedor. Ese contrato es justamente lo que falló acá: Handlebars resuelve
 * una variable ausente a cadena vacía SIN error, así que una variable que no
 * viaja no se nota en ningún log — se nota en el asunto `[] Tu pedido fue
 * cancelado #` que le llega al cliente.
 */
export function buildOrderCancelledData(order: OrderGraphResult): Record<string, unknown> {
  const customerName =
    fullName(order.customer?.first_name, order.customer?.last_name) ||
    fullName(order.shipping_address?.first_name, order.shipping_address?.last_name) ||
    fullName(order.billing_address?.first_name, order.billing_address?.last_name);

  return {
    order_id: order.id,
    /**
     * De qué tienda es la orden. Sin esto `siteIdForNotification` cae al sitio
     * implícito y el mail sale con el branding global.
     *
     * Y acá no es sólo estética: la fila `order-cancelled` de desdeelsur tiene
     * `site_id = 'demo_main'`, no NULL. `pickTemplate` sólo alcanza una fila de
     * tienda si el envío trae el eje; sin él la plantilla que el operador editó y
     * publicó es INALCANZABLE y el mail sale con el HTML del código.
     */
    sales_channel_id: order.sales_channel_id ?? undefined,
    display_id: order.display_id ?? undefined,
    customer_name: customerName || undefined,
    order_date_formatted: formatOrderDate(order.created_at),
    /**
     * `subject` está declarada en `template-variables.ts` para esta key, y la fila
     * hermana `order-tracking` la interpola de verdad en su asunto. Acá el asunto de
     * la base hoy no la usa, pero el operador la ve ofrecida en el editor: si la
     * escribe y nadie la manda, el asunto queda mutilado sin un solo error. Mandarla
     * no cuesta nada y hace verdadera la variable que el admin promete.
     */
    subject: ORDER_CANCELLED_SUBJECT,
    /**
     * NO se piden items ni totales. La plantilla de esta key —ni la fila publicada
     * ni la del código— muestra líneas ni importes, y `template-variables.ts` no
     * declara ninguna variable de item para `order-cancelled`. Traerlos obligaría a
     * pedir `items.detail.quantity` (ver `order-placed-email.ts`: `items.quantity`
     * apunta a una columna que no existe y colapsa los totales a $0) para después
     * no pintarlos en ningún lado.
     */
  };
}

/**
 * Mail de "pedido cancelado" al cliente. Escucha `order.canceled`
 * (OrderWorkflowEvents.CANCELED, payload `{ id }`).
 *
 * ── POR QUÉ ES UN ARCHIVO NUEVO Y NO UN CANAL MÁS EN `order-cancelled-whatsapp` ──
 *
 * Los dos escuchan el mismo evento, así que meter el mail adentro del hermano de
 * WhatsApp parece ahorrar una consulta. No: acopla dos canales que fallan
 * DISTINTO. El de WhatsApp corta temprano con `return` cuando la orden no tiene
 * teléfono —que es el caso corriente en el checkout de invitado— y ese `return`
 * se llevaría puesto el mail, que sí tenía a quién llegar. Al revés también: si
 * Kapso se cuelga, el timeout no puede quedar entre el cliente y su correo.
 *
 * El repo ya tiene el patrón de hermanos por canal (`password-reset-email.ts` /
 * `password-reset-whatsapp.ts`, `order-placed-email.ts` / `order-placed-whatsapp.ts`)
 * y Medusa corre los subscribers de un mismo evento de forma independiente: uno que
 * falla no cancela al otro.
 *
 * Best-effort: cualquier fallo se loguea y NUNCA se propaga al event bus. Un
 * problema de notificación no puede afectar a la cancelación, que ya ocurrió.
 */
export default async function handleOrderCancelledEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data?.id;
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
        'created_at',
        'email',
        'sales_channel_id',
        'customer.first_name',
        'customer.last_name',
        // Respaldos del nombre: en el checkout de invitado no hay `customer` con
        // nombre cargado y el único lugar donde el comprador lo escribió es la
        // dirección. Sin esto el saludo cae al genérico teniendo el dato a mano.
        'shipping_address.first_name',
        'shipping_address.last_name',
        'billing_address.first_name',
        'billing_address.last_name',
      ],
      filters: { id: orderId },
    })) as { data: OrderGraphResult[] };
    order = orders[0];
  } catch (error) {
    logger.warn(
      `[Order Email] No se pudieron leer los datos de la orden ${orderId}: ${(error as Error).message}`,
    );
    return;
  }

  if (!order) return;

  if (!order.email) {
    logger.warn(`[Order Email] Orden ${order.id} sin email — se omite la cancelación.`);
    return;
  }

  try {
    await notificationService.createNotifications({
      to: order.email,
      channel: 'email',
      template: 'order-cancelled',
      data: buildOrderCancelledData(order),
    });
  } catch (error) {
    logger.warn(
      `[Order Email] order-cancelled no enviado a ${order.email} (orden ${order.id}): ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
};
