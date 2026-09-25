import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { getAdminNotificationEmail } from '../modules/email/admin-recipient';
import { buildPickupContext } from '../modules/email/pickup-context';
import { buildOrderStockContext, type OrderStockItemView } from '../modules/email/order-stock-context';

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
  /**
   * Se pide SÓLO para el retiro en tienda: es el eje para llegar al inventario
   * (variante → inventory item → nivel por ubicación) y así decirle al operador
   * cuánto hay de esta línea EN LA SUCURSAL que eligió el comprador.
   */
  variant_id?: string | null;
  title?: string | null;
  /**
   * Titulo del PRODUCTO, sin el color. En las lineas entonadas `title` lleva el
   * color pegado — lo escribe `POST /store/tinting/line-items` para que se vea
   * en el resumen de orden del admin, que no renderiza ni `subtitle` ni la
   * metadata. Las plantillas ya pintan el color por su cuenta con
   * `color_label`, asi que aca se usa este para no decirlo dos veces.
   */
  product_title?: string | null;
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
  /** Metadata de la LINEA. De aca sale `tint` (el color entonado). */
  metadata?: Record<string, unknown> | null;
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
  /**
   * `data` viaja además del nombre porque ahí vive `store_id`: es el respaldo de
   * `metadata.store_id` para saber qué sucursal eligió el comprador cuando la
   * orden es de retiro en tienda. Ver `modules/email/pickup-context.ts`.
   *
   * `shipping_option_id` es el eje para resolver la ubicación de stock en una
   * orden que NO es de retiro: `shipping_option → service_zone.fulfillment_set_id
   * → location_fulfillment_set.stock_location_id`. Ver
   * `modules/email/order-stock-context.ts`.
   */
  shipping_methods?: {
    name?: string | null;
    data?: Record<string, unknown> | null;
    shipping_option_id?: string | null;
  }[];
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
/**
 * El color entonado de la linea, si la tiene.
 *
 * Se lee a mano en vez de importar `readTintMetadata` del modulo `erp` A
 * PROPOSITO: este subscriber lo posee la extension `email-templates`, y una
 * instalacion puede tener los mails sin el ERP. Un import cruzado dejaria el
 * backend sin bootear en esa combinacion. Son ocho lineas duplicadas contra un
 * acople entre extensiones — y la lectura es tolerante justamente porque el
 * objeto viene de ordenes viejas, no de nosotros.
 *
 * Contrato de `metadata.tint` (lo escribe `POST /store/tinting/line-items`):
 * `{ version, cod_base, cod_formula, color_code, color_name, collection,
 * color_hex, lista, quoted_unit_price }`.
 */
export function tintOfItem(item: OrderItem): {
  color_name: string;
  color_code: string;
  color_hex: string | null;
  color_label: string;
} | null {
  const tint = item.metadata?.tint as Record<string, unknown> | undefined;
  if (!tint || typeof tint !== 'object') return null;
  const name = typeof tint.color_name === 'string' ? tint.color_name : '';
  const code = typeof tint.color_code === 'string' ? tint.color_code : '';
  if (!name && !code) return null;
  const label = name || code;
  const suffix = code && label !== code ? ` (${code})` : '';
  return {
    color_name: name,
    color_code: code,
    // Sin hex conocido va `null`: la plantilla dibuja un gris neutro. Inventar
    // un color seria mostrarle al comprador una pintura que no es la que recibe.
    //
    // Se valida la FORMA y no solo el tipo porque este valor termina dentro de
    // un atributo `style` del HTML del mail. Handlebars escapa, pero un hex que
    // no es un hex tampoco pinta nada util.
    color_hex: typeof tint.color_hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(tint.color_hex)
      ? tint.color_hex
      : null,
    color_label: `${label}${suffix}`,
  };
}

export function mapOrderItem(item: OrderItem) {
  const quantity = quantityOf(item);
  const unitPrice = Number(item.unit_price) || 0;
  const tint = tintOfItem(item);
  return {
    // Entonada va el titulo LIMPIO: el color lo pinta la plantilla aparte, con
    // `color_label`. Sin entonar el valor es exactamente el de antes.
    title: (tint ? item.product_title : null) ?? item.title ?? undefined,
    variant_title: item.variant_title ?? undefined,
    /**
     * `color_label` es el unico campo que las plantillas necesitan mirar: viene
     * ya armado ("Brisa Chic (82YR 83/056)") y ausente cuando la linea no va
     * entonada, asi que un `{{#if}}` alcanza. Los sueltos quedan para quien
     * quiera maquetar distinto.
     */
    color_label: tint?.color_label,
    color_name: tint?.color_name || undefined,
    color_code: tint?.color_code || undefined,
    color_hex: tint?.color_hex ?? undefined,
    quantity,
    unit_price: unitPrice,
    unit_price_formatted: formatMoney(item.unit_price),
    // El total calculado si vino; si no, la multiplicacion. El `??` y no `||`: un
    // total legitimamente 0 (linea bonificada) no tiene que caer al respaldo.
    line_total_formatted: formatMoney(item.total ?? item.detail?.total ?? unitPrice * quantity),
    thumbnail: item.thumbnail ?? undefined,
  };
}

/**
 * Une un ítem del mail con su estado de stock, SÓLO para el mail admin.
 *
 * Es una función aparte (y no un campo más de `mapOrderItem`) porque
 * `sharedData.order_items` viaja TAL CUAL al mail del CLIENTE: si el stock se
 * agregara ahí, el comprador vería si hay o no mercadería de su propia compra.
 * Ver el armado de `sharedData` y del payload del mail admin más abajo.
 */
type WithStockStatus<T> = T & {
  stock_status?: OrderStockItemView['status'];
  stock_status_label?: string;
  stock_status_color?: string;
  stock_available_label?: string;
};

export function withStockStatus<T>(item: T, stock: OrderStockItemView | undefined): WithStockStatus<T> {
  if (!stock) return item as WithStockStatus<T>;
  return {
    ...item,
    stock_status: stock.status,
    stock_status_label: stock.status_label,
    stock_status_color: stock.status_color,
    stock_available_label: stock.available_label,
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
        // Sin esto el mail de una linea entonada diria el color DOS VECES: una
        // pegada al titulo y otra en el chip de `color_label`.
        'items.product_title',
        'items.variant_title',
        'items.unit_price',
        'items.thumbnail',
        /**
         * El color entonado vive en `metadata.tint` de la LINEA, y sin pedirlo
         * explicitamente `query.graph` no lo trae: el mail salia con la pintura
         * y el recargo de entonado cobrado, pero sin decir nunca de que color.
         * Mismo campo que ya pide el outbox del ERP para armar la venta.
         */
        'items.metadata',
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
        /**
         * SIN ESTO EL MAIL COBRA EL IVA DOS VECES. `getLineItemTotals`
         * (`@medusajs/utils` → `totals/line-item`) decide si el `unit_price` YA
         * incluye el impuesto con `item.is_tax_inclusive ?? context.includeTax`:
         * sin pedir `items.is_tax_inclusive` explícitamente llega `undefined`,
         * cae al default del contexto, y una línea con precio CON IVA se trata
         * como si fuera SIN IVA — el 21% se suma una segunda vez sobre un monto
         * que ya lo tenía adentro. Mismo mecanismo, mismo síntoma que
         * `items.quantity` más arriba: una columna que no se pidió y ningún
         * error que lo diga. Caso real (desdeelsur, orden #81): `unit_price` con
         * IVA incluido, el mail mostró `subtotal_formatted` = `total` (el bug no
         * le restaba el impuesto a NADA) y `total` = `subtotal` × 1,21 exacto.
         */
        'items.is_tax_inclusive',
        // Retiro en tienda. `items.variant_id` es el eje hacia el inventario y
        // `shipping_methods.data` el respaldo de `metadata.store_id`: el
        // storefront escribe la sucursal en la metadata del carrito, pero una
        // orden vieja (o creada por otra vía) puede tenerla sólo en el método.
        'items.variant_id',
        'shipping_methods.name',
        'shipping_methods.data',
        // Resolver la ubicación de stock en una orden que NO es de retiro (ver
        // `modules/email/order-stock-context.ts`).
        'shipping_methods.shipping_option_id',
        /**
         * Mismo mecanismo que `items.is_tax_inclusive`, pero del lado del envío:
         * `getShippingMethodTotals` lee `shippingMethod.is_tax_inclusive` con el
         * mismo fallback, Y ADEMÁS necesita `shippingMethod.amount` para la
         * cuenta entera (`MathBN.convert(shippingMethod.amount)`) — sin pedirlo,
         * el costo de envío se calcula sobre `undefined`.
         */
        'shipping_methods.is_tax_inclusive',
        'shipping_methods.amount',
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

  /**
   * Contexto de retiro en tienda. `null` para una orden de envío a domicilio, y
   * entonces ninguna de las dos plantillas dibuja nada nuevo.
   *
   * Se pide UNA sola vez con `withStock` aunque el mail del cliente no use el
   * inventario: la consulta es la misma para los dos y repetirla sería pagar dos
   * veces por la misma respuesta. El reparto se hace abajo — `pickup_items` es
   * información OPERATIVA y no viaja al comprador.
   *
   * Nunca lanza (ver pickup-context.ts): si la sucursal no se puede leer, el
   * aviso de las 24 h sale igual y lo único que falta es el nombre del local.
   */
  const pickup = await buildPickupContext(container, order, { withStock: true });
  if (pickup?.pickup_has_stock_issues) {
    logger.info(
      `[Order Email] Orden ${order.id} de retiro en ${pickup.pickup_store?.name ?? 'sucursal desconocida'}: hay líneas sin stock suficiente en esa sucursal.`,
    );
  }

  /**
   * Estado de stock por línea para CUALQUIER orden (no sólo retiro) — el mail
   * admin lo pinta al lado de cada ítem del "Resumen del pedido". Generaliza a
   * `pickup`, que sólo cubre retiro en tienda: la orden #81 (envío a domicilio)
   * no mostraba nada de stock porque `buildPickupContext` devuelve `null` sin
   * `store_id`. Es una consulta APARTE de la de `pickup` (para retiro, las dos
   * resuelven la misma sucursal y pagan la lectura de inventario dos veces):
   * separarlas evita tocar `pickup_items`, que la plantilla de desdeelsur ya
   * consume tal cual desde su base.
   *
   * Nunca lanza (ver `order-stock-context.ts`): sin ubicación resoluble, cada
   * línea queda "no determinada" y el mail sale igual.
   */
  const orderStock = await buildOrderStockContext(container, {
    metadata: order.metadata,
    shipping_methods: order.shipping_methods,
    items: (order.items ?? []).map((item) => ({
      line_item_id: item.id,
      variant_id: item.variant_id ?? null,
      quantity: quantityOf(item),
    })),
  });

  // Datos compartidos por ambas plantillas (usuario y admin).
  const sharedData = {
    /**
     * El aviso de las 24 h y el nombre del local: los ve el cliente Y el operador.
     *
     * Las dos van SIEMPRE, con valor real, y no sólo cuando hay retiro. La
     * pantalla de análisis de envíos (`admin/email-templates/[id]/sends`) marca
     * como FALTANTE toda variable declarada que no viaja en el payload, así que
     * emitirlas condicionalmente pintaría en rojo todos los mails de envío a
     * domicilio por dos datos que esos mails no necesitan.
     *
     * `false` y `null` no son lo mismo para esa pantalla y acá eso juega a favor:
     * `is_store_pickup: false` se lee `ok` (es una respuesta) y `pickup_store:
     * null` se lee `vacío` (no hay sucursal porque no hay retiro), que es
     * exactamente lo que pasó. Ninguna de las dos es una alarma.
     */
    is_store_pickup: Boolean(pickup),
    pickup_store: pickup?.pickup_store ?? null,
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
    /**
     * `order_items` CON el estado de stock de cada línea, para el mail admin.
     * Se arma acá y NO en `sharedData` para que no viaje al mail del cliente
     * (`sharedData.order_items` sigue siendo el mismo array de siempre, sin
     * estos campos): mostrarle a un comprador si su propia compra tiene o no
     * stock sería contarle el inventario de la tienda.
     */
    const adminOrderItems = orderItems.map((item, index) => {
      const lineItemId = order.items?.[index]?.id;
      const stock = lineItemId ? orderStock.by_line_item_id.get(lineItemId) : undefined;
      return withStockStatus(item, stock);
    });

    try {
      await notificationService.createNotifications({
        to: adminEmail,
        channel: 'email',
        template: 'order-notification-admin',
        data: {
          ...sharedData,
          recipient_type: 'creator',
          order_items: adminOrderItems,
          // De qué ubicación es el stock de arriba, y si alguna línea tiene un
          // problema real (`insufficient`/`none`). Nunca por `not_tracked`
          // (no corresponde mirarla) ni por `unknown` (no se pudo determinar).
          stock_location_name: orderStock.stock_location_name,
          has_stock_issues: orderStock.has_stock_issues,
          // SÓLO al buzón interno. Es la disponibilidad real de cada línea en la
          // sucursal elegida: le sirve al operador para saber si puede preparar
          // el pedido, y mandársela al comprador sería contarle el inventario.
          // Mismo criterio que arriba: valor real siempre. Array vacío y `false`
          // dicen "no hay retiro", que es una respuesta; ausentes dirían "falta
          // un dato", que es una alarma falsa en toda venta a domicilio.
          //
          // Se SIGUEN emitiendo por compatibilidad: la plantilla que desdeelsur
          // ya tiene editada a mano en su base los consume tal cual.
          pickup_items: pickup?.pickup_items ?? [],
          pickup_has_stock_issues: Boolean(pickup?.pickup_has_stock_issues),
        },
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
