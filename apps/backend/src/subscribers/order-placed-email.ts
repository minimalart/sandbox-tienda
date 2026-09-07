import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { getAdminNotificationEmail } from '../modules/email/admin-recipient';

type OrderAddress = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone?: string | null;
} | null;

type OrderItem = {
  id: string;
  title?: string | null;
  variant_title?: string | null;
  /**
   * OJO: `quantity` NO es una columna de la linea. Es del DETALLE VERSIONADO
   * (`OrderItem`), y llega aca sólo porque `formatOrder` de Medusa lo copia al
   * nivel de arriba cuando el detalle fue efectivamente seleccionado. Si no se
   * pide `items.detail.*`, esto llega `undefined` — nunca `null`, nunca un error.
   */
  quantity?: number | null;
  unit_price?: number | null;
  total?: number | null;
  thumbnail?: string | null;
  /** El detalle versionado crudo. Se lee como respaldo de `quantity`. */
  detail?: { quantity?: number | null; total?: number | null } | null;
};

type OrderGraphResult = {
  id: string;
  display_id?: number | null;
  created_at?: string | Date | null;
  email: string | null;
  currency_code: string;
  customer_id: string | null;
  sales_channel_id?: string | null;
  total?: number | null;
  subtotal?: number | null;
  shipping_total?: number | null;
  discount_total?: number | null;
  metadata?: Record<string, unknown> | null;
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress;
  items?: OrderItem[];
  shipping_methods?: { name?: string | null }[];
};

/**
 * Formatea un importe monetario en formato es-AR (1.234,56) sin símbolo, ya que
 * las plantillas anteponen el "$" donde corresponde.
 */
function formatMoney(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * La cantidad de una linea, mirando primero el nivel de arriba y despues el detalle.
 *
 * Son DOS lugares porque Medusa devuelve la cantidad en dos formas segun como se
 * haya pedido, y la de arriba es una COPIA que su `formatOrder` hace del detalle.
 * Esa copia tiene una salida temprana (`isFormatted`) que devuelve el item tal cual
 * vino, asi que no esta garantizada. Leer sólo `item.quantity` es apostar a que la
 * copia ocurrio; leer los dos no cuesta nada y no depende de esa rama.
 *
 * El `?? undefined` antes del `Number` importa: `Number(null)` es 0, asi que sin eso
 * un `quantity: null` de arriba taparia el valor bueno del detalle.
 */
export function quantityOf(item: {
  quantity?: number | null;
  detail?: { quantity?: number | null } | null;
}): number {
  return Number(item.quantity ?? item.detail?.quantity ?? undefined) || 0;
}

/**
 * Una linea del mail. Se exporta para poder testear la aritmetica sin levantar el
 * contenedor: es el punto exacto donde una cantidad en 0 se volvia un precio en $0.
 */
export function mapOrderItem(item: OrderItem) {
  const quantity = quantityOf(item);
  const unitPrice = Number(item.unit_price) || 0;
  return {
    title: item.title ?? undefined,
    variant_title: item.variant_title ?? undefined,
    quantity,
    unit_price: unitPrice,
    unit_price_formatted: formatMoney(item.unit_price),
    // El total calculado si vino; si no, la multiplicacion. El `??` y no `||`: un
    // total legitimamente 0 (linea bonificada) no tiene que caer al respaldo.
    line_total_formatted: formatMoney(item.total ?? item.detail?.total ?? unitPrice * quantity),
    thumbnail: item.thumbnail ?? undefined,
  };
}

function fullName(
  first?: string | null,
  last?: string | null,
): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/**
 * Formatea la fecha de la orden en es-AR (ej. "16/6/26, 14:30"). Devuelve
 * undefined si la fecha es inválida — las plantillas la muestran con {{#if}}.
 */
function formatOrderDate(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Arma la dirección de envío en una sola línea a partir del objeto de dirección,
 * descartando los campos vacíos. Devuelve undefined si no hay nada que mostrar.
 */
function oneLineAddress(addr: OrderAddress | undefined): string | undefined {
  if (!addr) return undefined;
  const parts = [
    addr.address_1,
    addr.address_2,
    addr.city,
    addr.province,
    addr.postal_code,
    addr.country_code,
  ]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function mapAddress(
  addr: OrderAddress | undefined,
): Record<string, string | undefined> | undefined {
  if (!addr) return undefined;
  return {
    first_name: addr.first_name ?? undefined,
    last_name: addr.last_name ?? undefined,
    company: addr.company ?? undefined,
    address_1: addr.address_1 ?? undefined,
    address_2: addr.address_2 ?? undefined,
    city: addr.city ?? undefined,
    province: addr.province ?? undefined,
    postal_code: addr.postal_code ?? undefined,
    country_code: addr.country_code ?? undefined,
    phone: addr.phone ?? undefined,
  };
}

/**
 * Envía los correos de "orden creada":
 *  - `order-confirmation` al cliente (order.email).
 *  - `order-notification-admin` al destinatario admin configurado.
 *
 * Reune los datos de la orden vía query.graph (mismo enfoque que los demás
 * subscribers de order.placed). Cualquier fallo de envío se loguea como warning
 * y NUNCA se propaga al event bus.
 */
export default async function handleOrderPlacedEmail({
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
        'created_at',
        'email',
        'currency_code',
        // De qué tienda es la orden. Sin esto el mail sale con el branding global y
        // el WhatsApp desde el número global: los dos providers resuelven la tienda
        // desde la `data` de la notificación, porque en un subscriber no hay request.
        'sales_channel_id',
        'customer_id',
        'total',
        'subtotal',
        'shipping_total',
        'discount_total',
        'metadata',
        'customer.first_name',
        'customer.last_name',
        'customer.phone',
        'shipping_address.*',
        'billing_address.*',
        'items.id',
        'items.title',
        'items.variant_title',
        'items.unit_price',
        'items.thumbnail',
        /**
         * `items.detail.*` ES EL ARREGLO, y sin esto el mail sale con "0 x $precio"
         * y TOTAL $0 en todas las lineas.
         *
         * `quantity` no existe en `OrderLineItem`: vive en `OrderItem`, el detalle
         * versionado (`@medusajs/order/dist/models/order-item.js`). Y el mapeo interno
         * de Medusa (`utils/transform-order.js mapRepositoryToOrderModel`) reescribe
         * `items.<campo>` a `items.item.<campo>`, o sea CONTRA LA LINEA. Resultado:
         * pedir `items.quantity` terminaba consultando `OrderLineItem.quantity`, una
         * columna que no existe, y devolvia `undefined` sin un solo error. Sólo
         * `items.detail.<campo>` esquiva esa reescritura (se remapea a `items.<campo>`,
         * que ES el detalle). Es lo mismo que pide el admin de Medusa, que anda:
         * `*items` + `*items.detail` en `admin/orders/query-config.js`.
         *
         * Y de ahi se caia TODO lo demas. Los totales de la orden no salen de una
         * columna: `decorateCartTotals` los CALCULA sobre los items. Con `quantity`
         * en `undefined`, `total` y `subtotal` daban 0 — por eso el sintoma que se
         * reporto fue "no aparecen los precios" y no "falta la cantidad".
         *
         * La prueba de que el eje es la SELECCION y no la data: el subscriber gemelo
         * de WhatsApp pide `total` y NINGUN campo de items, asi que Medusa popula el
         * detalle entero y su total sale correcto — 0,9 s antes que este mail y sobre
         * la misma orden.
         *
         * NO se pide el total de la linea, ni por `items.total` ni por
         * `items.detail.total`: no es una columna de NINGUNO de los dos modelos. Lo
         * calcula `decorateCartTotals` despues de la consulta, asi que llega solo. El
         * mapeo de `orderItems` lo usa si esta y si no multiplica precio por cantidad.
         */
        'items.detail.quantity',
        'shipping_methods.name',
      ],
      filters: { id: orderId },
    })) as { data: OrderGraphResult[] };
    return orders[0];
  };
  // Suma de cantidades: si es 0 pero hay items, el detalle versionado de la orden
  // (order_item + summary) todavía no está commiteado.
  const totalQuantityOf = (order?: OrderGraphResult): number =>
    (order?.items ?? []).reduce((sum, item) => sum + quantityOf(item), 0);

  let order: OrderGraphResult | undefined;
  try {
    order = await loadOrder();
  } catch (error) {
    logger.warn(
      `[Order Email] No se pudieron leer los datos de la orden ${orderId}: ${(error as Error).message}`,
    );
    return;
  }

  if (!order) return;

  /**
   * En órdenes B2B el detalle de los items puede no estar commiteado al emitirse
   * `order.placed` (se computa en un paso posterior de completeCartWorkflow):
   * quedaría "0 x $precio" y subtotal $0 en el mail. Reintentar unas pocas veces
   * hasta que aparezcan las cantidades reales. Mismo patrón que su gemelo de
   * WhatsApp. Ver [[b2b-order-placed-subscribers-link-timing]].
   *
   * SE CONSERVA, PERO HASTA HOY NO PODIA FUNCIONAR — y eso es justo lo que hizo
   * dificil encontrar el bug de arriba. Con `items.quantity` la cantidad llegaba
   * `undefined` SIEMPRE, por seleccionar una columna inexistente y no por timing:
   * este loop reintentaba 5 veces la MISMA consulta que estructuralmente devolvia
   * 0, agotaba los intentos y mandaba el mail igual. Dos segundos y medio de nada,
   * con la forma de una defensa que ya estaba resuelta. Recien ahora que el campo
   * es el correcto puede de verdad cubrir el caso para el que se escribio.
   *
   * Y por eso queda: con el campo arreglado el loop es un no-op en la orden normal
   * (entra sólo si la cantidad es 0), asi que no cuesta nada; y no tengo con qué
   * descartar el caso B2B que motivó al gemelo de WhatsApp, donde el mismo patrón
   * sí se observó funcionando.
   */
  if (order.items && order.items.length > 0) {
    for (let attempt = 0; attempt < 5 && totalQuantityOf(order) === 0; attempt++) {
      await sleep(500);
      try {
        order = (await loadOrder()) ?? order;
      } catch {
        // Reintento efímero: si falla, seguimos con lo que teníamos.
      }
    }
  }

  const customerName = fullName(order.customer?.first_name, order.customer?.last_name);
  const customerPhone =
    order.customer?.phone ?? order.shipping_address?.phone ?? order.billing_address?.phone ?? undefined;

  const orderItems = (order.items ?? []).map(mapOrderItem);

  const discounts =
    Number(order.discount_total) > 0
      ? [{ label: 'Descuento', amount_formatted: formatMoney(order.discount_total) }]
      : [];

  const shippingDisplay =
    Number(order.shipping_total) > 0 ? `$ ${formatMoney(order.shipping_total)}` : 'Gratis';

  // Datos compartidos por ambas plantillas (usuario y admin).
  const sharedData = {
    order_id: order.id,
    sales_channel_id: order.sales_channel_id ?? undefined,
    display_id: order.display_id ?? undefined,
    order_date_formatted: formatOrderDate(order.created_at),
    total: formatMoney(order.total),
    subtotal_formatted: formatMoney(order.subtotal),
    shipping_formatted: formatMoney(order.shipping_total),
    shipping_display: shippingDisplay,
    discount_total_formatted: formatMoney(order.discount_total),
    discounts,
    customer_email: order.email ?? undefined,
    customer_name: customerName || undefined,
    customer_phone: customerPhone,
    order_items: orderItems,
    shipping_address: mapAddress(order.shipping_address),
    shipping_address_one_line: oneLineAddress(order.shipping_address),
    billing_address: mapAddress(order.billing_address),
    shipping_method_name: order.shipping_methods?.[0]?.name ?? undefined,
  };

  // 1) Confirmación al cliente.
  if (order.email) {
    try {
      await notificationService.createNotifications({
        to: order.email,
        channel: 'email',
        template: 'order-confirmation',
        data: { ...sharedData, recipient_type: 'customer' },
      });
    } catch (error) {
      logger.warn(
        `[Order Email] order-confirmation no enviado a ${order.email} (orden ${order.id}): ${(error as Error).message}`,
      );
    }
  } else {
    logger.warn(`[Order Email] Orden ${order.id} sin email — se omite confirmación al cliente.`);
  }

  // 2) Notificación al admin.
  //
  // La copia interna se resuelve con la MISMA tienda que el mail del cliente. Sin
  // la pista, `getEmailBranding()` leía la fila global y toda venta de toda tienda
  // avisaba al buzón de la principal: la mitad que no se mira, porque el operador
  // ve salir bien el mail del comprador y asume que el suyo también.
  //
  // Ojo con lo que este cambio NO hace: la CANTIDAD de mails no se mueve. Sigue
  // siendo uno al cliente y uno al admin por orden; lo único que cambia es a qué
  // casilla llega el segundo. Un fan-out por tienda acá sería el error inverso.
  //
  // Va el canal y NO `orderId`: la pista indirecta de `resolveSite` resuelve el
  // canal releyendo la orden (`channelOfEntity`), o sea el mismo valor que ya está
  // acá. Mandarla sería pagar un `retrieveOrder` extra para llegar al dato que ya
  // tenemos, y con `sales_channel_id` nulo devolvería nulo igual.
  const adminEmail = await getAdminNotificationEmail(container, {
    salesChannelId: order.sales_channel_id ?? undefined,
  });
  if (adminEmail) {
    try {
      await notificationService.createNotifications({
        to: adminEmail,
        channel: 'email',
        template: 'order-notification-admin',
        data: { ...sharedData, recipient_type: 'creator' },
      });
    } catch (error) {
      logger.warn(
        `[Order Email] order-notification-admin no enviado a ${adminEmail} (orden ${order.id}): ${(error as Error).message}`,
      );
    }
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
