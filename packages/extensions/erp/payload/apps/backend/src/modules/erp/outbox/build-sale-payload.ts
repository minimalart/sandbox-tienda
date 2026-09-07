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
    variant_sku?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total?: number | null;
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
    fields: [
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
      'items.variant_sku',
      'items.quantity',
      'items.unit_price',
      // Metadata de la LÍNEA: acá vive `tint` (base + fórmula del entonado). Sin
      // este campo la metadata llegaría `undefined` y el pedido iría al ERP sin
      // el color, porque abajo sólo se pedía `items.variant.metadata`.
      'items.metadata',
      'items.total',
      // Alícuota de IVA por artículo que deja el catalog sync (`zeus_por_iva`):
      // el catálogo no es uniforme y el adapter la necesita por línea.
      'items.variant.metadata',
      'shipping_methods.name',
      'payment_collections.payments.id',
      'payment_collections.payments.amount',
      'payment_collections.payments.currency_code',
      'payment_collections.payments.provider_id',
      'payment_collections.payments.captured_at',
    ],
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
    items: (order.items ?? []).map((item) => ({
      sku: item.variant_sku ?? null,
      title: item.title ?? null,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      total: toNumber(item.total),
      tax_rate: taxRateFromVariant(item.variant?.metadata),
      tint: tintFromLine(item.metadata),
    })),
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
