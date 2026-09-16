import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { CountryLayer } from '../countries/types';
import { sanitizePayload } from '../sanitize';
import { readTintMetadata } from '../tinting/line-metadata';
import type { ErpSalePayload } from '../types';

/**
 * Arma el payload de venta (PRD §8.3) por ALLOWLIST desde la orden: solo los
 * campos que el ERP necesita. Del pago viaja apenas `{provider_id, monto,
 * moneda}` — nunca `payment.data` ni tokens del provider. El documento fiscal
 * lo resuelve la capa país desde `metadata.billing_snapshot`.
 */

type OrderAddress = {
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
} | null;

type OrderGraphResult = {
  id: string;
  display_id?: number | null;
  created_at?: string | Date | null;
  email?: string | null;
  currency_code?: string | null;
  customer_id?: string | null;
  total?: number | null;
  subtotal?: number | null;
  shipping_total?: number | null;
  discount_total?: number | null;
  tax_total?: number | null;
  metadata?: Record<string, unknown> | null;
  customer?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: OrderAddress;
  items?: Array<{
    title?: string | null;
    /**
     * Título del PRODUCTO, sin el color: en las líneas entonadas `title` lleva
     * el color pegado para que se vea en el resumen de orden del admin (ver
     * `tinting/line-metadata.ts`), así que el ERP lee este.
     */
    product_title?: string | null;
    variant_sku?: string | null;
    /**
     * OJO: `quantity` NO es una columna de la línea. Vive en el DETALLE
     * versionado, y si la consulta no pide `items.detail.*` llega `undefined`
     * — nunca `null`, nunca un error. Leerla siempre con `lineQuantityOf`.
     */
    quantity?: number | null;
    unit_price?: number | null;
    total?: number | null;
    /** El detalle versionado crudo. Es el respaldo real de `quantity`. */
    detail?: { quantity?: number | null; total?: number | null } | null;
    /** Metadata de la LÍNEA (no de la variante): de acá sale `tint`. */
    metadata?: Record<string, unknown> | null;
    variant?: { metadata?: Record<string, unknown> | null } | null;
  }>;
  shipping_methods?: Array<{ name?: string | null }>;
  payment_collections?: Array<{
    payments?: Array<{
      id: string;
      amount?: number | null;
      currency_code?: string | null;
      provider_id?: string | null;
      captured_at?: string | Date | null;
    }> | null;
  }> | null;
};

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toIso = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Alícuota de IVA del artículo (en porcentaje) que el catalog sync guardó en la
 * variante. `null` → el adapter cae a su tasa global configurada.
 */
const taxRateFromVariant = (metadata: Record<string, unknown> | null | undefined): number | null => {
  const raw = metadata?.zeus_por_iva;
  if (raw === null || raw === undefined || raw === '') return null;
  const pct = Number(raw);
  return Number.isFinite(pct) && pct >= 0 ? pct : null;
};

/**
 * Entonado de la línea, si la tiene. Se lee de la metadata de la LÍNEA (la
 * escribió `POST /store/tinting/line-items`), no de la variante: la base es la
 * misma variante para todos los colores.
 */
const tintFromLine = (metadata: Record<string, unknown> | null | undefined) => {
  const tint = readTintMetadata(metadata);
  if (!tint) return null;
  return {
    cod_base: tint.cod_base,
    cod_formula: tint.cod_formula,
    color_code: tint.color_code || null,
    color_name: tint.color_name || null,
  };
};

/**
 * Cantidad de la línea, con el detalle versionado como respaldo.
 *
 * Se leen los DOS lados a propósito. `items.detail.quantity` se remapea a
 * `items.quantity` en la respuesta, así que normalmente alcanza con el primero;
 * pero según cómo Medusa popule el detalle puede venir por el otro, y un `null`
 * de arriba taparía el valor bueno de abajo si se leyera uno solo.
 *
 * Es una copia deliberada de `quantityOf` de `subscribers/order-placed-email.ts`
 * y no un import: ese archivo es de otra extensión, y un helper compartido entre
 * dos dueños se cae del payload del composer sin ningún error. La duplicación
 * de tres líneas es más barata que ese modo de falla.
 */
export const lineQuantityOf = (item: {
  quantity?: number | null;
  detail?: { quantity?: number | null } | null;
}): number => toNumber(item.quantity ?? item.detail?.quantity);

/**
 * Total de la línea. `decorateCartTotals` lo calcula DESPUÉS de la consulta, así
 * que llega solo y no hay que pedirlo; el producto precio × cantidad queda como
 * último recurso para no mandarle un cero al ERP si ese cálculo no corrió.
 */
export const lineTotalOf = (item: {
  quantity?: number | null;
  unit_price?: number | null;
  total?: number | null;
  detail?: { quantity?: number | null; total?: number | null } | null;
}): number => {
  const total = item.total ?? item.detail?.total;
  if (total !== null && total !== undefined) return toNumber(total);
  return toNumber(item.unit_price) * lineQuantityOf(item);
};

/**
 * Campos que la venta necesita de la orden. Exportado para que el test pueda
 * atarlo: la lista ES el bug. Un campo mal nombrado acá no rompe nada — llega
 * `undefined` y termina en un cero silencioso adentro de un comprobante.
 */
export const SALE_ORDER_FIELDS: readonly string[] = [
  'id',
  'display_id',
  'created_at',
  'email',
  'currency_code',
  'customer_id',
  'total',
  'subtotal',
  'shipping_total',
  'discount_total',
  'tax_total',
  'metadata',
  'customer.id',
  'customer.first_name',
  'customer.last_name',
  'customer.phone',
  'shipping_address.address_1',
  'shipping_address.address_2',
  'shipping_address.city',
  'shipping_address.province',
  'shipping_address.postal_code',
  'shipping_address.country_code',
  'items.title',
  // Sin este campo el remito diría el color DOS VECES: `title` ya lo trae
  // pegado en las líneas entonadas y el adapter de Zeus arma la descripción
  // como `<título> — Color <nombre>`.
  'items.product_title',
  'items.variant_sku',
  'items.unit_price',
  // Metadata de la LÍNEA: acá vive `tint` (base + fórmula del entonado). Sin
  // este campo la metadata llegaría `undefined` y el pedido iría al ERP sin
  // el color, porque abajo sólo se pedía `items.variant.metadata`.
  'items.metadata',
  /**
   * `items.detail.quantity` ES EL ARREGLO, y no pedirlo mandaba al ERP un
   * comprobante con CANTIDAD 0 Y TOTAL 0 — sin un solo error en ningún lado.
   *
   * `quantity` no existe en `OrderLineItem`: vive en `OrderItem`, el detalle
   * versionado. Y el mapeo interno de Medusa reescribe `items.<campo>` a
   * `items.item.<campo>`, o sea CONTRA LA LÍNEA, así que pedir
   * `items.quantity` consultaba una columna inexistente y devolvía
   * `undefined`. Sólo `items.detail.<campo>` esquiva esa reescritura.
   *
   * Y de ahí se caía TODO lo demás: los totales de la orden no son una
   * columna, los CALCULA `decorateCartTotals` sobre los items. Con la
   * cantidad en `undefined`, `total`, `subtotal` e `iva` daban 0 — por eso
   * el síntoma no fue "falta la cantidad" sino un comprobante en cero.
   *
   * Mismo bug y mismo arreglo que en el mail de confirmación de orden
   * (`subscribers/order-placed-email.ts`), donde está la explicación larga.
   *
   * NO se pide el total de la línea, ni por `items.total` ni por
   * `items.detail.total`: no es columna de NINGUNO de los dos modelos. Lo
   * calcula `decorateCartTotals` después de la consulta, así que llega solo
   * — pedirlo es lo que hacía esta lista y no servía de nada.
   */
  'items.detail.quantity',
  // Alícuota de IVA por artículo que deja el catalog sync (`zeus_por_iva`):
  // el catálogo no es uniforme y el adapter la necesita por línea.
  'items.variant.metadata',
  'shipping_methods.name',
  'payment_collections.payments.id',
  'payment_collections.payments.amount',
  'payment_collections.payments.currency_code',
  'payment_collections.payments.provider_id',
  'payment_collections.payments.captured_at',
];

/** Devuelve `null` si la orden no existe. */
export async function buildSalePayload(
  container: MedusaContainer,
  opts: {
    orderId: string;
    eventKey: string;
    country: CountryLayer;
    /** Depósito facturador confirmado para esta orden; `null` = usar la config. */
    billingDeposito?: string | null;
  }
): Promise<ErpSalePayload | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: SALE_ORDER_FIELDS as string[],
    filters: { id: opts.orderId },
  })) as { data: OrderGraphResult[] };

  const order = orders[0];
  if (!order) return null;

  const document = opts.country.inferDocument({ metadata: order.metadata ?? null });
  const payments = (order.payment_collections ?? []).flatMap((pc) => pc.payments ?? []);
  // Monto notificado = total de la orden; del pago se toma la primera captura
  // como referencia (capturas parciales/múltiples colapsan en un solo evento).
  const capturedPayment = payments.find((p) => p.captured_at) ?? payments[0] ?? null;
  const address = order.shipping_address ?? null;
  const street = [address?.address_1, address?.address_2].filter(Boolean).join(' ').trim() || null;

  const payload: ErpSalePayload = {
    event_key: opts.eventKey,
    order_id: order.id,
    billing_deposito: opts.billingDeposito ?? null,
    display_id: order.display_id ?? null,
    created_at: toIso(order.created_at),
    country_code: opts.country.code,
    currency_code: order.currency_code ?? opts.country.currency,
    customer: {
      id: order.customer?.id ?? order.customer_id ?? null,
      email: order.email ?? null,
      first_name: order.customer?.first_name ?? null,
      last_name: order.customer?.last_name ?? null,
      phone: opts.country.normalizePhone(order.customer?.phone),
      document,
    },
    items: (order.items ?? []).map((item) => {
      const tint = tintFromLine(item.metadata);
      return {
        sku: item.variant_sku ?? null,
        // Entonada va el título LIMPIO del producto, porque el color se lo
        // agrega el adapter a la descripción. Sin entonar el valor es
        // exactamente el de antes.
        title: (tint ? item.product_title : null) ?? item.title ?? null,
        quantity: lineQuantityOf(item),
        unit_price: toNumber(item.unit_price),
        total: lineTotalOf(item),
        tax_rate: taxRateFromVariant(item.variant?.metadata),
        tint,
      };
    }),
    totals: {
      subtotal: toNumber(order.subtotal),
      discount: toNumber(order.discount_total),
      shipping: toNumber(order.shipping_total),
      tax: toNumber(order.tax_total),
      total: toNumber(order.total),
    },
    payment: {
      provider_id: capturedPayment?.provider_id ?? null,
      captured_amount: capturedPayment ? toNumber(capturedPayment.amount) : null,
      currency_code: capturedPayment?.currency_code ?? null,
    },
    shipping: {
      method: order.shipping_methods?.[0]?.name ?? null,
      address: {
        street,
        city: address?.city ?? null,
        province: address?.province ?? null,
        postal_code: opts.country.normalizePostalCode(address?.postal_code),
        country_code: address?.country_code ?? null,
      },
    },
  };

  return sanitizePayload(payload) as ErpSalePayload;
}
