import { ContainerRegistrationKeys, ModuleRegistrationName } from '@medusajs/framework/utils';
import type { MedusaRequest } from '@medusajs/framework';
import type { SiteResolution } from '../../lib/multistore/types';

/**
 * Reemplaza, SÓLO EN `sample_data`, los productos hardcodeados del seed
 * (`scripts/seed-email-templates.ts`: "Yerba Mate Premium 1kg", "Termo Acero
 * Inoxidable"…) por productos REALES del catálogo de la tienda activa.
 *
 * `sample_data` lo escribió una sola vez el seed, para TODAS las instalaciones, y
 * la fila de cada tienda lo conserva para siempre (el seed no se re-corre en un
 * deploy y no se puede: hay tiendas con diseños editados a mano). Una pinturería
 * viendo "Yerba Mate Premium 1kg" en la vista previa de su propio mail no es un
 * detalle estético — es la señal de que la plantilla nunca fue pensada para ella.
 *
 * Se reemplaza una línea SÓLO si su producto NO EXISTE en el catálogo de la
 * tienda. Es el único criterio que distingue "inventado" de "real":
 *  - la primera versión corría sólo con `data == null`, y el editor del admin
 *    (`admin/routes/email-templates/[id]/page.tsx`, `test-send-modal.tsx`) manda
 *    SIEMPRE `data`, así que nunca se ejecutaba;
 *  - la segunda comparaba `data` contra el `sample_data` guardado: pisaba
 *    productos REALES que el operador ya había cargado (y les dejaba el color de
 *    la línea vieja: "Extracto de banana — Color: Rosa Espléndido"), y no
 *    cubría el "Enviar prueba" de un par admin/cliente, que manda a las DOS
 *    filas el sample de la que se está editando.
 * Tradeoff asumido: un operador que escribe a mano un producto que no está en su
 * catálogo lo va a ver reemplazado — en una vista previa, un producto que la
 * tienda no vende es justamente lo que no hay que mostrar.
 *
 * Dos partes, a propósito:
 *  - `applyCatalogSampleProducts` es PURA: sample + productos ya resueltos →
 *    sample nuevo. Se testea sin tocar la base.
 *  - `fetchCatalogSampleProducts` es el I/O: resuelve la tienda, la moneda y los
 *    productos vía `query.graph`. NUNCA lanza — un catálogo vacío, un módulo
 *    ausente o una consulta que falla tienen que devolver `[]`, nunca romper la
 *    vista previa.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Parte pura
// ─────────────────────────────────────────────────────────────────────────────

export type CatalogSampleProduct = {
  title: string;
  thumbnail: string | null;
  variant_title: string | null;
  sku: string | null;
  /** En unidades de moneda (Medusa v2 no divide por 100). `null` = sin precio resoluble. */
  unit_price: number | null;
};

/**
 * Formatea un importe en es-AR con dos decimales — misma convención que
 * `formatMoney` de `subscribers/order-placed-email.ts`. Se DUPLICA (no se
 * importa) porque ese archivo es un subscriber con su propio ciclo de vida
 * (`handleOrderPlacedEmail`) y este módulo tiene que poder testearse solo,
 * sin arrastrar sus dependencias.
 */
export function formatCatalogAmount(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parsea un importe formateado (punto de miles, coma decimal — o el `punto sin
 * decimales` que usa el seed, ej. "3.500") a número. `null` si no se puede: el
 * caller tiene que quedarse con el valor del sample en vez de inventar uno.
 */
export function parseFormattedAmount(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^0-9.,-]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** ¿Esta entrada de un array de `sample_data` es una línea de producto? Lo es si tiene `title`. */
const looksLikeProductLine = (entry: unknown): entry is Record<string, unknown> =>
  isPlainObject(entry) && typeof entry.title === 'string';

const isProductLineArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.length > 0 && value.every(looksLikeProductLine);

const quantityOf = (line: Record<string, unknown>): number => {
  const raw = line.quantity;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/**
 * Reescribe UNA línea con un producto real. Se preserva TODO lo que la línea ya
 * tenía (`quantity`, y en `order-notification-admin` los `stock_status*` — esos
 * campos no viajan al mail del cliente y acá tampoco hay por qué tocarlos) y sólo
 * se sobreescriben los campos de producto que la forma de la línea ya declaraba.
 * No se AGREGAN claves nuevas: si la línea no tenía `sku`, el producto real
 * tampoco lo deja.
 */
function swapLine(
  line: Record<string, unknown>,
  product: CatalogSampleProduct,
): { line: Record<string, unknown>; lineTotal: number } {
  const quantity = quantityOf(line);
  const unitPrice = product.unit_price ?? 0;
  const lineTotal = unitPrice * quantity;

  // Los `color_*` son del producto VIEJO (el color entonado de esa línea): se
  // descartan, o el producto nuevo sale con un color que no le corresponde.
  const next: Record<string, unknown> = Object.fromEntries(
    Object.entries(line).filter(([k]) => !k.startsWith('color_')),
  );
  next.title = product.title;
  if ('thumbnail' in line) next.thumbnail = product.thumbnail ?? '';
  if ('variant_title' in line) next.variant_title = product.variant_title ?? line.variant_title;
  if ('sku' in line) next.sku = product.sku ?? line.sku;
  if ('unit_price_formatted' in line) next.unit_price_formatted = formatCatalogAmount(unitPrice);
  if ('line_total_formatted' in line) next.line_total_formatted = formatCatalogAmount(lineTotal);

  return { line: next, lineTotal };
}

/**
 * El envío como NÚMERO, a partir de las dos formas que usan los templates:
 * `shipping_formatted` (siempre un importe) o `shipping_display` ("Gratis" o
 * "$ X"). `null` = no se pudo leer — el caller no recalcula el total.
 */
function parseShippingAmount(sample: Record<string, unknown>): number | null {
  if (typeof sample.shipping_formatted === 'string') {
    return parseFormattedAmount(sample.shipping_formatted);
  }
  if (typeof sample.shipping_display === 'string') {
    if (sample.shipping_display.trim().toLowerCase() === 'gratis') return 0;
    return parseFormattedAmount(sample.shipping_display);
  }
  return null;
}

/**
 * La suma de `discounts[].amount_formatted`. `0` si no hay clave `discounts` o
 * viene vacía; `null` si algo no se puede leer con certeza (incluido
 * `makes_free`, que no es un importe) — mismo criterio que el envío.
 */
function parseDiscountsAmount(sample: Record<string, unknown>): number | null {
  const discounts = sample.discounts;
  if (discounts === undefined) return 0;
  if (!Array.isArray(discounts)) return null;
  if (discounts.length === 0) return 0;

  let total = 0;
  for (const entry of discounts) {
    if (!isPlainObject(entry) || entry.makes_free) return null;
    const amount = parseFormattedAmount(entry.amount_formatted);
    if (amount === null) return null;
    total += amount;
  }
  return total;
}

/**
 * `sample` con los productos hardcodeados reemplazados por `products`, y los
 * totales recompuestos cuando se puede hacer sin inventar nada.
 *
 * Recorre las claves de primer nivel buscando arrays "de línea de producto"
 * (entradas con `title`) — hoy es siempre `order_items` o `items`, pero no se
 * hardcodea el nombre: cualquier array con esa forma se reemplaza. Se asume UN
 * solo array de este tipo por sample (es lo que hay en los 42 templates del
 * seed); si hubiera dos, el segundo pisaría el cálculo de totales del primero.
 *
 * Con `knownTitles`, sólo se reemplazan las líneas cuyo `title` NO está en ese
 * set (los productos que la tienda no tiene); las demás quedan intactas. Sin
 * `knownTitles` se reemplazan todas. Un array con todas sus líneas conocidas no
 * se toca, y tampoco sus totales.
 *
 * Nunca se repite un producto: se saltean los que ya están en el array. Con menos
 * productos reales que líneas a reemplazar, las que sobran se sacan en vez de
 * repetir.
 */
export function applyCatalogSampleProducts(
  sample: Record<string, unknown> | null | undefined,
  products: readonly CatalogSampleProduct[],
  opts: { knownTitles?: ReadonlySet<string> } = {},
): Record<string, unknown> {
  if (!isPlainObject(sample)) return sample ?? {};

  const isKnown = (line: Record<string, unknown>) => opts.knownTitles?.has(line.title as string) ?? false;
  const result: Record<string, unknown> = { ...sample };
  let touched = false;

  for (const [key, value] of Object.entries(sample)) {
    if (!isProductLineArray(value)) continue;
    if (value.every(isKnown)) continue;

    const alreadyThere = new Set(value.map((l) => l.title as string));
    const pool = products.filter((p) => !alreadyThere.has(p.title));
    if (pool.length === 0) continue;
    touched = true;

    const newLines: Record<string, unknown>[] = [];
    let subtotal: number | null = 0;
    let next = 0;
    for (const line of value) {
      if (isKnown(line)) {
        newLines.push(line);
        const kept = parseFormattedAmount(line.line_total_formatted);
        subtotal = subtotal === null || kept === null ? null : subtotal + kept;
        continue;
      }
      const product = pool[next++];
      if (!product) continue;
      const swapped = swapLine(line, product);
      newLines.push(swapped.line);
      if (subtotal !== null) subtotal += swapped.lineTotal;
    }
    result[key] = newLines;

    // Si una línea conservada no tiene un importe legible, no hay cuenta que
    // cierre: se dejan los totales del sample antes que mostrar uno inventado.
    if (subtotal === null) continue;

    if ('subtotal_formatted' in sample) {
      // Patrón order-confirmation / order-notification-admin / quotation-*: el
      // subtotal sale directo de las líneas nuevas.
      result.subtotal_formatted = formatCatalogAmount(subtotal);

      if ('total' in sample) {
        const discounts = parseDiscountsAmount(sample);
        const shipping = parseShippingAmount(sample);
        // Sólo se toca `total` si las DOS partes se pudieron leer con certeza.
        // Si no, se deja el `total` original del sample antes que mostrar una
        // cuenta que no cierra con lo que el operador ve en pantalla.
        if (discounts !== null && shipping !== null) {
          result.total = formatCatalogAmount(subtotal - discounts + shipping);
        }
      }
    } else if ('order_total_formatted' in sample) {
      // Patrón kit-cde-notification: un solo total, sin descuentos ni envío.
      result.order_total_formatted = formatCatalogAmount(subtotal);
    }
  }

  return touched ? result : sample;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parte I/O
// ─────────────────────────────────────────────────────────────────────────────

type QueryGraph = {
  graph: (input: unknown) => Promise<{ data: unknown[] }>;
};

type CatalogProductRow = {
  id: string;
  title?: string | null;
  thumbnail?: string | null;
  variants?: Array<{
    title?: string | null;
    sku?: string | null;
    prices?: Array<{ amount?: number | null; currency_code?: string | null }> | null;
  }> | null;
};

/** Cuántos productos candidatos se piden como máximo — de sobra para cualquier template (el más largo tiene 2 líneas). */
const FETCH_LIMIT = 12;

/**
 * Cuántas filas del canal se miran para encontrar candidatos. El link no se puede
 * filtrar por `status`, así que se toma una página de ids y DESPUÉS se filtran los
 * publicados: con 40 (el valor original), un catálogo grande con borradores al
 * principio del orden por id se quedaba sin ningún candidato y la vista previa
 * volvía en silencio a los productos del seed.
 */
const CHANNEL_SCAN_LIMIT = 500;

/**
 * Ids de producto de los canales de la tienda, para UNA página (no hace falta
 * recorrer el link entero: alcanza con un puñado de candidatos).
 *
 * Distinto de `lib/multistore/product-scope.ts` a propósito: ese helper trae
 * TODOS los ids y tira si el catálogo supera un tope — correcto para paginar un
 * listado, pero acá alcanza con una página y una vista previa NUNCA puede
 * lanzar. `singleSite` también devuelve `null` (no filtrar), mismo criterio que
 * `product-scope.ts`: con una sola tienda, filtrar por canal escondería
 * productos de un canal armado a mano que no pertenece a ninguna tienda.
 */
async function scopedProductIds(
  query: QueryGraph,
  resolution: SiteResolution,
  take: number,
): Promise<string[] | null> {
  if (resolution.status !== 'site') return null;

  const { data: links } = (await query.graph({
    entity: 'product_sales_channel',
    fields: ['product_id'],
    filters: { sales_channel_id: resolution.site.channel_ids },
    pagination: { skip: 0, take, order: { id: 'ASC' } },
  })) as { data: Array<{ product_id?: string | null }> };

  return [...new Set(links.map((l) => l.product_id).filter((id): id is string => Boolean(id)))];
}

/**
 * La moneda contra la que se leen los precios: la región de la tienda activa, o
 * si no hay tienda elegida (o no tiene región), la región default del Store.
 * Mismo fallback que `admin/store-config/commerce/context/route.ts`. `null` si
 * no se puede resolver ninguna — el producto sale sin precio, no rompe nada.
 */
async function resolveCatalogCurrency(
  req: MedusaRequest,
  resolution: SiteResolution,
): Promise<string | null> {
  const regionService = req.scope.resolve(ModuleRegistrationName.REGION) as {
    listRegions: (
      filter: Record<string, unknown>,
      config?: Record<string, unknown>,
    ) => Promise<Array<{ currency_code?: string | null }>>;
  };

  const regionId =
    resolution.status === 'site' || resolution.status === 'singleSite'
      ? resolution.site.region_id
      : null;

  if (regionId) {
    const [region] = await regionService.listRegions({ id: regionId }, { take: 1 });
    if (region?.currency_code) return region.currency_code;
  }

  const storeService = req.scope.resolve(ModuleRegistrationName.STORE) as {
    listStores: (
      filter: Record<string, unknown>,
      config?: Record<string, unknown>,
    ) => Promise<Array<{ default_region_id?: string | null }>>;
  };
  const [store] = await storeService.listStores({}, { take: 1 });
  if (store?.default_region_id) {
    const [region] = await regionService.listRegions({ id: store.default_region_id }, { take: 1 });
    if (region?.currency_code) return region.currency_code;
  }

  return null;
}

/**
 * Un producto Medusa → la forma que necesita `applyCatalogSampleProducts`.
 *
 * El precio es el de la PRIMERA variante con un precio en `currencyCode`; si
 * ninguna lo tiene, la primera variante con CUALQUIER precio (mejor un precio en
 * otra moneda que ninguno); si ninguna tiene precio, `unit_price: null` — la
 * línea sale con el producto real pero sin inventar un importe. Deliberadamente
 * NO es el precio calculado (`calculated_price`, con reglas y promociones): para
 * una vista previa importa que el producto exista y tenga nombre e imagen
 * reales, no reproducir el motor de precios — y ese motor sí puede lanzar en
 * casos borde que acá no pueden tumbar nada.
 */
function toSampleProduct(row: CatalogProductRow, currencyCode: string | null): CatalogSampleProduct | null {
  if (!row.title) return null;
  const variants = row.variants ?? [];

  const priceOf = (v: (typeof variants)[number]) =>
    currencyCode
      ? (v.prices ?? []).find((p) => (p.currency_code ?? '').toLowerCase() === currencyCode.toLowerCase())
      : undefined;

  let chosen: { title?: string | null; sku?: string | null; amount?: number | null } | undefined;
  for (const v of variants) {
    const price = priceOf(v);
    if (price) {
      chosen = { title: v.title, sku: v.sku, amount: price.amount };
      break;
    }
  }
  if (!chosen) {
    const withAnyPrice = variants.find((v) => (v.prices ?? []).length > 0);
    if (withAnyPrice) {
      chosen = { title: withAnyPrice.title, sku: withAnyPrice.sku, amount: withAnyPrice.prices?.[0]?.amount };
    } else if (variants[0]) {
      chosen = { title: variants[0].title, sku: variants[0].sku, amount: null };
    }
  }

  return {
    title: row.title,
    thumbnail: row.thumbnail ?? null,
    variant_title: chosen?.title ?? null,
    sku: chosen?.sku ?? null,
    unit_price: typeof chosen?.amount === 'number' ? chosen.amount : null,
  };
}

/**
 * Productos reales de la tienda activa, listos para `applyCatalogSampleProducts`.
 *
 * BEST-EFFORT: catálogo vacío, módulo ausente o consulta que falla → `[]`, nunca
 * una excepción. El caller (`withCatalogSampleData`) trata `[]` igual que
 * cualquier otro fallo — se queda con el `sample_data` del seed tal cual.
 */
export async function fetchCatalogSampleProducts(
  req: MedusaRequest,
  resolution: SiteResolution,
  limit: number = FETCH_LIMIT,
): Promise<CatalogSampleProduct[]> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;

    const productIds = await scopedProductIds(query, resolution, CHANNEL_SCAN_LIMIT);
    // La tienda existe pero no vende nada en su canal: no hay nada que ofrecer,
    // y NO hay que caer a "todos los productos" (eso mostraría el catálogo de
    // otra tienda).
    if (productIds !== null && productIds.length === 0) return [];

    const currencyCode = await resolveCatalogCurrency(req, resolution).catch(() => null);

    const { data: products } = (await query.graph({
      entity: 'product',
      fields: [
        'id',
        'title',
        'thumbnail',
        'updated_at',
        'variants.title',
        'variants.sku',
        'variants.prices.amount',
        'variants.prices.currency_code',
      ],
      filters: {
        status: 'published',
        ...(productIds ? { id: productIds } : {}),
      },
      pagination: { skip: 0, take: Math.max(limit * 4, 40), order: { updated_at: 'DESC' } },
    })) as { data: CatalogProductRow[] };

    const candidates = products
      .map((p) => toSampleProduct(p, currencyCode))
      .filter((p): p is CatalogSampleProduct => p !== null);

    // Con miniatura primero. `Array.prototype.sort` es estable en Node: dentro de
    // cada grupo se conserva el orden por `updated_at` que ya trajo la consulta.
    candidates.sort((a, b) => Number(Boolean(b.thumbnail)) - Number(Boolean(a.thumbnail)));

    return candidates.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * De `titles`, los que son productos de la tienda activa (en su canal, si hay una
 * tienda elegida). `null` si no se pudo consultar: el caller no reemplaza nada,
 * porque sin saber qué existe no puede distinguir inventado de real.
 */
export async function fetchKnownTitles(
  req: MedusaRequest,
  resolution: SiteResolution,
  titles: readonly string[],
): Promise<Set<string> | null> {
  if (titles.length === 0) return new Set();
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;
    const { data: rows } = (await query.graph({
      entity: 'product',
      fields: ['id', 'title'],
      filters: { title: [...new Set(titles)] },
    })) as { data: Array<{ id: string; title?: string | null }> };

    let found = rows;
    if (resolution.status === 'site' && rows.length > 0) {
      const { data: links } = (await query.graph({
        entity: 'product_sales_channel',
        fields: ['product_id'],
        filters: { product_id: rows.map((r) => r.id), sales_channel_id: resolution.site.channel_ids },
      })) as { data: Array<{ product_id?: string | null }> };
      const inSite = new Set(links.map((l) => l.product_id));
      found = rows.filter((r) => inSite.has(r.id));
    }
    return new Set(found.map((r) => r.title).filter((t): t is string => Boolean(t)));
  } catch {
    return null;
  }
}

/**
 * Los datos con los que `preview` y `test-send` renderizan: `data` del caller si
 * lo mandó, si no el `sample_data` guardado; con las líneas de productos que la
 * tienda NO tiene cambiadas por productos reales — ver el comentario del módulo.
 *
 * Si todas las líneas son productos de la tienda (o la plantilla no tiene), no
 * se trae ningún candidato. Nunca lanza.
 */
export async function withCatalogSampleData(
  req: MedusaRequest,
  resolution: SiteResolution,
  data: Record<string, unknown> | null | undefined,
  stored: Record<string, unknown> | null | undefined,
): Promise<Record<string, unknown>> {
  const base = data ?? stored ?? {};
  const titles = Object.values(base)
    .filter(isProductLineArray)
    .flatMap((lines) => lines.map((l) => l.title as string));
  if (titles.length === 0) return base;
  try {
    const knownTitles = await fetchKnownTitles(req, resolution, titles);
    if (knownTitles === null || titles.every((t) => knownTitles.has(t))) return base;
    const products = await fetchCatalogSampleProducts(req, resolution);
    if (products.length === 0) return base;
    return applyCatalogSampleProducts(base, products, { knownTitles });
  } catch {
    return base;
  }
}
