import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { CountryLayer } from '../countries/types';
import { sanitizePayload } from '../sanitize';
import { readTintMetadata } from '../tinting/line-metadata';
import type { ErpSalePayload } from '../types';

/**
 * Snapshot congelado del step Alumnos + escuela que lo emitió. Se resuelve por
 * `order → order_cart → site_checkout_session.snapshot_id → site_checkout_snapshot`.
 * Ausente en la tienda principal (no hay `demo_store` asociado), ausente en
 * repos que no tengan la extensión multistore instalada — el `try/catch` del
 * loader cubre ambos casos y devuelve `null` sin ruido.
 */
type RecipientsSnapshot = {
  site: { id: string; slug: string; name: string };
  people: Array<{
    id: string;
    first_name: string;
    last_name: string;
    document?: string | null;
    grade?: string | null;
  }>;
  units: Array<{ id: string; line_id: string; line_key: string; person_id: string | null }>;
};

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
    id?: string;
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
  // El `id` de cada item es lo que después usamos para mapear `unit → sku` en
  // el enrichment de destinatarios: `mapOrderUnits` matchea por
  // `metadata.checkout_line_key` y devuelve `order_line_id` = ese id.
  'items.id',
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

/**
 * Trae el snapshot de destinatarios y el `demo_store` (escuela) que emitió el
 * checkout. Devuelve `null` cuando: la orden no vino de un site con recipients,
 * el snapshot expiró/no existe, o la extensión multistore no está instalada
 * (tablas ausentes). En todos los casos el resultado es "no hay data extra que
 * enviar al ERP" — el payload viaja idéntico al de la tienda principal.
 *
 * Todo el bloque va en try/catch a propósito: cualquier fallo acá NO debe
 * bloquear el envío del pedido al ERP. La regresión que evita es la típica
 * "una extensión opcional rompe el checkout completo" cuando en realidad su
 * ausencia es un estado válido.
 */
export async function loadRecipientsSnapshot(
  container: MedusaContainer,
  orderId: string
): Promise<RecipientsSnapshot | null> {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: links } = await query.graph({
      entity: 'order_cart',
      fields: ['cart_id'],
      filters: { order_id: orderId },
    });
    const cartId = links?.[0]?.cart_id;
    if (!cartId) return null;

    const pg: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    const session = await pg('site_checkout_session').where({ cart_id: cartId }).first();
    if (!session?.snapshot_id) return null;

    const snapshot = await pg('site_checkout_snapshot')
      .where({ id: session.snapshot_id, cart_id: cartId })
      .first();
    if (!snapshot) return null;

    // Un snapshot existe cuando el checkout policy del site está activo (aunque
    // sea para OTROS steps: billing, delivery, etc.). Sin `recipients.enabled`,
    // people/units siempre vienen vacíos: no hay data de escuela para reportar.
    // Chequeamos el flag del policy congelado en el snapshot (no la config
    // actual del site) para preservar la semántica en el momento del checkout.
    if (snapshot.policy?.recipients?.enabled !== true) return null;

    const site = await pg('demo_store').where({ id: snapshot.site_id }).first();
    if (!site || site.is_main === true) return null;

    // `pg` (knex) parsea `jsonb` a objetos JS al leer, no hace falta JSON.parse
    // — mismo tratamiento que en `api/admin/orders/[id]/checkout/route.ts`.
    return {
      site: { id: site.id, slug: site.slug, name: site.name },
      people: snapshot.people ?? [],
      units: snapshot.units ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Transforma el shape flat del snapshot (`units[]` con `person_id` por unidad)
 * al shape agrupado por SKU que le proponemos a Odoo (§8.3 del contrato).
 *
 * Agrupación:
 *  - Cada `unit` se resuelve a un `order.item` por `line_key` (usando la misma
 *    lógica que `mapOrderUnits`, replicada acá para no depender del módulo
 *    demo-store desde el ERP builder).
 *  - Items del pedido con el mismo SKU se colapsan en un único `item` — cliente
 *    poco común, pero pasa con líneas tintadas o promo splits.
 *  - Dentro de cada SKU los recipients se agrupan por `external_id` con la
 *    `quantity` que le corresponde (suma de unidades asignadas a esa persona).
 *
 * Salidas explícitas:
 *  - `document`: `null` si el alumno no cargó DNI (viene `undefined`/`''`).
 *  - `grade`:    `null` si no cargó grado.
 *  - Líneas sin recipients no se listan (el ERP las ve como líneas comunes).
 */
export function toStudentAssignments(
  snapshot: RecipientsSnapshot,
  orderItems: Array<{ id?: string; variant_sku?: string | null; metadata?: Record<string, unknown> | null }>
): ErpSalePayload['student_assignments'] {
  const peopleById = new Map(snapshot.people.map((p) => [p.id, p]));

  // Map `line_key` → order item (id + sku). `mapOrderUnits` exige match único,
  // acá lo replicamos silencioso: si el key no matchea 1-a-1, la unidad se
  // descarta del envío en vez de romper el pedido en el ERP.
  const itemByLineKey = new Map<string, { id: string; sku: string | null }>();
  for (const item of orderItems) {
    const key = item?.metadata?.checkout_line_key;
    if (typeof key !== 'string' || !item?.id) continue;
    if (itemByLineKey.has(key)) {
      // Ambigüedad: dos líneas con el mismo checkout_line_key. Lo tratamos
      // como no-match para no arriesgar mandarle a Odoo destinatarios pegados
      // a la línea equivocada. `mapOrderUnits` tira error en este caso.
      itemByLineKey.set(key, { id: '', sku: null });
      continue;
    }
    itemByLineKey.set(key, { id: item.id, sku: item.variant_sku ?? null });
  }

  // Agrupar por SKU → { qty, recipients: personId → qty }
  const bySku = new Map<string, { qty: number; recipients: Map<string, number> }>();
  for (const unit of snapshot.units) {
    if (!unit.person_id) continue;
    const mapped = itemByLineKey.get(unit.line_key);
    if (!mapped || !mapped.id || !mapped.sku) continue;
    const bucket = bySku.get(mapped.sku) ?? { qty: 0, recipients: new Map<string, number>() };
    bucket.qty += 1;
    bucket.recipients.set(unit.person_id, (bucket.recipients.get(unit.person_id) ?? 0) + 1);
    bySku.set(mapped.sku, bucket);
  }

  if (bySku.size === 0) return null;

  return {
    schema_version: '1.0',
    items: [...bySku.entries()].map(([sku, { qty, recipients }]) => ({
      sku,
      quantity: qty,
      recipients: [...recipients.entries()].map(([pid, qtyPerPerson]) => {
        const person = peopleById.get(pid);
        // Guardia: `assertCoverage` garantiza que el `person_id` existe en
        // `people`, pero si el snapshot llegara corrupto preferimos no romper
        // el envío al ERP — se manda con datos vacíos y el operador humano lo
        // detecta antes que el proceso automatizado.
        return {
          external_id: pid,
          first_name: person?.first_name ?? '',
          last_name: person?.last_name ?? '',
          document: person?.document ?? null,
          grade: person?.grade ?? null,
          quantity: qtyPerPerson,
        };
      }),
    })),
  };
}

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

  // Enrichment de escuela + asignación de alumnos. Vive DESPUÉS del `payload`
  // base para que si `loadRecipientsSnapshot` tira, los campos queden `null` y
  // el envío al ERP siga sin datos extra (mismo comportamiento que tienda
  // principal). Al día de hoy los adapters existentes (Odoo, Bsale, Zeus,
  // Contabilium) NO leen estos dos campos, así que la outbox los persiste como
  // registro business pero el `sale.order.create` de Odoo NO los envía hasta
  // que el equipo Odoo confirme los nombres técnicos finales (ver adapters/odoo.ts).
  const recipients = await loadRecipientsSnapshot(container, opts.orderId);
  if (recipients) {
    payload.school = {
      external_ref: recipients.site.slug,
      name: recipients.site.name,
      source_site_id: recipients.site.id,
    };
    payload.student_assignments = toStudentAssignments(recipients, order.items ?? []);
  } else {
    payload.school = null;
    payload.student_assignments = null;
  }

  return sanitizePayload(payload) as ErpSalePayload;
}
