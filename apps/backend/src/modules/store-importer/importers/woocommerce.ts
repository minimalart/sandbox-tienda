/**
 * WooCommerce catalog importer.
 *
 * Uses the public WooCommerce Store API. It first walks categories to preserve
 * category paths when possible, then supplements from the global product list.
 */
import type {
  ImporterContext,
  NormalizedProduct,
  NormalizedVariant,
  ProductImporter,
} from '../../demo-store/catalog/types';
import {
  baseUrlCandidates,
  buildHandle,
  limitToTarget,
  normalizeTargetCount,
  reachedTarget,
  resilientFetch,
  slugify,
  stripHtml,
  targetLabel,
} from '../../demo-store/catalog/util';

const PER_PAGE = 100;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Browser-like headers help avoid trivial WAF blocks. Throttle + backoff and the
// 429/403/503 handling (incl. throwing RateLimitedError on a persistent block, so
// the import fails loudly instead of silently returning 0) live in resilientFetch.
async function wooFetch(url: string, retries = 4): Promise<Response> {
  let origin = '';
  try {
    origin = new URL(url).origin;
  } catch {
    /* malformed url: leave Referer/Origin unset */
  }
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    'User-Agent': USER_AGENT,
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    ...(origin ? { Referer: `${origin}/`, Origin: origin } : {}),
  };
  return resilientFetch(url, { headers }, retries);
}

type WooImage = { src?: string };
type WooProductCategory = { id?: number; name?: string };
type WooPrices = { price?: string; regular_price?: string; currency_minor_unit?: number };
type WooAttributeTerm = { name?: string };
type WooAttribute = { name?: string; has_variations?: boolean; terms?: WooAttributeTerm[] };
/** Variación de un producto variable: id + valores de atributo (slug, ej "16-kilos"). */
type WooVariationRef = {
  id?: number;
  attributes?: Array<{ name?: string; value?: string }>;
};
type WooProduct = {
  id: number;
  name: string;
  slug?: string;
  sku?: string;
  type?: string;
  description?: string;
  short_description?: string;
  prices?: WooPrices;
  attributes?: WooAttribute[];
  images?: WooImage[];
  categories?: WooProductCategory[];
  is_in_stock?: boolean;
  variations?: WooVariationRef[];
};

type WooCategoryNode = { id: number; name: string; parent: number; count: number };

function cleanName(input: string): string {
  return String(input ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchCategoryTree(base: string): Promise<Map<number, WooCategoryNode>> {
  const map = new Map<number, WooCategoryNode>();
  for (let page = 1; ; page++) {
    const res = await wooFetch(
      `${base}/wp-json/wc/store/v1/products/categories?per_page=100&page=${page}`,
    );
    if (!res.ok) break;
    const list = (await res.json()) as Array<{
      id: number;
      name: string;
      parent?: number;
      count?: number;
    }>;
    if (!Array.isArray(list) || list.length === 0) break;
    for (const c of list) {
      map.set(c.id, {
        id: c.id,
        name: cleanName(c.name),
        parent: Number(c.parent ?? 0),
        count: Number(c.count ?? 0),
      });
    }
    if (list.length < 100) break;
  }
  return map;
}

function depthOf(id: number, tree: Map<number, WooCategoryNode>): number {
  let depth = 0;
  let parent = tree.get(id)?.parent ?? 0;
  const seen = new Set<number>();
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    depth++;
    parent = tree.get(parent)?.parent ?? 0;
  }
  return depth;
}

function chainNames(id: number, tree: Map<number, WooCategoryNode>): string[] {
  const names: string[] = [];
  const seen = new Set<number>();
  let current: number | undefined = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = tree.get(current);
    if (!node) break;
    names.unshift(node.name);
    current = node.parent || undefined;
  }
  return names.filter(Boolean);
}

function toMajorUnit(raw: string | undefined, minorUnit: number | undefined): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / 10 ** (minorUnit ?? 2));
}

export type VariationPrice = { price: number; listPrice: number };

/**
 * Precio POR VARIACIÓN de un producto variable de WooCommerce. El Store API de
 * lista sólo trae el precio MÍNIMO del producto (por eso el import viejo ponía el
 * mismo precio a todas las variantes). Para el precio de cada tamaño hay que
 * pedir el producto por id (trae `variations: [{id, attributes}]`) y luego cada
 * variación por id (`/products/{variationId}` → su propio `prices`).
 *
 * Devuelve un mapa keyed por el SLUG del valor de atributo (ej "16-kilos"), para
 * matchear contra `slugify(valorMostrado)` tanto en el importer como en el
 * backfill. Best-effort: una variación que no baja se saltea.
 */
export async function fetchWooVariationPrices(
  base: string,
  productId: string | number,
): Promise<Map<string, VariationPrice>> {
  const map = new Map<string, VariationPrice>();
  let variations: WooVariationRef[] | undefined;
  try {
    const res = await wooFetch(`${base}/wp-json/wc/store/v1/products/${productId}`);
    if (!res.ok) return map;
    variations = ((await res.json()) as WooProduct).variations;
  } catch {
    return map;
  }
  for (const variation of variations ?? []) {
    const slug = String(variation.attributes?.[0]?.value ?? '')
      .trim()
      .toLowerCase();
    if (!variation.id || !slug) continue;
    try {
      const res = await wooFetch(`${base}/wp-json/wc/store/v1/products/${variation.id}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { prices?: WooPrices };
      const price = toMajorUnit(data.prices?.price, data.prices?.currency_minor_unit);
      if (price <= 0) continue;
      const listPrice =
        toMajorUnit(data.prices?.regular_price, data.prices?.currency_minor_unit) || price;
      map.set(slug, { price, listPrice });
    } catch {
      /* variación inaccesible: se saltea */
    }
  }
  return map;
}

async function normalize(
  raw: WooProduct,
  categoryPath: string[],
  base: string,
): Promise<NormalizedProduct | null> {
  if (raw.is_in_stock === false) return null;
  const title = cleanName(raw.name);
  if (!title) return null;

  const price = toMajorUnit(raw.prices?.price, raw.prices?.currency_minor_unit);
  if (price <= 0) return null;
  const listPrice =
    toMajorUnit(raw.prices?.regular_price, raw.prices?.currency_minor_unit) || price;

  const sku = String(raw.sku ?? '').replace(/\s+/g, '');
  const productId = String(raw.id ?? '');
  const slug = buildHandle(title, sku || productId);

  const images = (raw.images ?? [])
    .map((image) => image.src)
    .filter((src): src is string => !!src)
    .slice(0, 4);

  // Variable products expose their size dimension as an attribute with
  // `has_variations` and a list of `terms`. El precio POR variación no viene en
  // el list endpoint (sólo el mínimo del producto); lo resolvemos pidiendo cada
  // variación (ver fetchWooVariationPrices). Si falla, cada tamaño conserva el
  // precio del producto — mejor que colapsar todo en "Único".
  let optionTitle: string | null = null;
  let variants: NormalizedVariant[] | undefined;
  const dimension = (raw.attributes ?? []).find(
    (attr) => attr.has_variations && Array.isArray(attr.terms) && attr.terms.length > 0,
  );
  if (dimension) {
    const seen = new Set<string>();
    const built: NormalizedVariant[] = [];
    for (const term of dimension.terms ?? []) {
      const value = cleanName(String(term.name ?? ''));
      if (!value || seen.has(value)) continue;
      seen.add(value);
      built.push({ value, ean: '', price, listPrice });
    }
    if (built.length > 0) {
      optionTitle = cleanName(String(dimension.name ?? '')) || 'Talle';
      // Precio real por tamaño (matcheamos el término con el slug de la variación).
      const variationPrices = await fetchWooVariationPrices(base, raw.id);
      if (variationPrices.size > 0) {
        for (const variant of built) {
          const match = variationPrices.get(slugify(variant.value));
          if (match) {
            variant.price = match.price;
            variant.listPrice = match.listPrice;
          }
        }
      }
      variants = built;
    }
  }

  return {
    ean: sku,
    productId,
    title,
    slug,
    description: stripHtml(String(raw.description ?? raw.short_description ?? '')),
    brand: null,
    categoryPath,
    price,
    listPrice,
    images,
    source: 'woocommerce',
    optionTitle,
    variants,
  };
}

function inlineCategoryPath(raw: WooProduct, tree: Map<number, WooCategoryNode>): string[] {
  const cats = raw.categories ?? [];
  if (cats.length === 0) return [];
  const ids = cats.map((cat) => Number(cat.id)).filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length > 0 && tree.size > 0) {
    const deepest = ids.reduce((a, b) => (depthOf(b, tree) > depthOf(a, tree) ? b : a), ids[0]!);
    const path = chainNames(deepest, tree);
    if (path.length) return path;
  }
  const last = cats[cats.length - 1]?.name;
  return last ? [cleanName(last)] : [];
}

async function importWooBase(
  base: string,
  target: number | undefined,
  log: ImporterContext['logger'],
): Promise<NormalizedProduct[]> {
  const tree = await fetchCategoryTree(base);
  log?.info(`WooCommerce category tree: ${tree.size} categories.`);

  const byKey = new Map<string, NormalizedProduct>();
  const cats = Array.from(tree.values())
    .filter((cat) => cat.count > 0)
    .sort((a, b) => depthOf(b.id, tree) - depthOf(a.id, tree));

  for (const cat of cats) {
    if (reachedTarget(byKey.size, target)) break;
    const path = chainNames(cat.id, tree);
    for (let page = 1; ; page++) {
      const url = `${base}/wp-json/wc/store/v1/products?category=${cat.id}&per_page=${PER_PAGE}&page=${page}`;
      const res = await wooFetch(url);
      if (!res.ok) break;
      const list = (await res.json()) as WooProduct[];
      if (!Array.isArray(list) || list.length === 0) break;
      for (const raw of list) {
        const product = await normalize(raw, path, base);
        if (!product) continue;
        const key = product.ean || `pid-${product.productId}`;
        if (!byKey.has(key)) byKey.set(key, product);
      }
      const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? 0);
      if (list.length < PER_PAGE || (totalPages && page >= totalPages)) break;
      if (reachedTarget(byKey.size, target)) break;
    }
  }

  if (!reachedTarget(byKey.size, target)) {
    for (let page = 1; ; page++) {
      const url = `${base}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`;
      const res = await wooFetch(url);
      if (res.status === 400 || res.status === 404) break;
      if (!res.ok) break;
      const list = (await res.json()) as WooProduct[];
      if (!Array.isArray(list) || list.length === 0) break;
      for (const raw of list) {
        const product = await normalize(raw, inlineCategoryPath(raw, tree), base);
        if (!product) continue;
        const key = product.ean || `pid-${product.productId}`;
        if (!byKey.has(key)) byKey.set(key, product);
      }
      const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? 0);
      if (list.length < PER_PAGE || (totalPages && page >= totalPages)) break;
      if (reachedTarget(byKey.size, target)) break;
    }
  }

  return limitToTarget(Array.from(byKey.values()), target);
}

export const wooCommerceImporter: ProductImporter = async (ctx: ImporterContext) => {
  const target = normalizeTargetCount(ctx.targetCount);
  const log = ctx.logger;

  for (const base of baseUrlCandidates(ctx.sourceUrl)) {
    log?.info(`WooCommerce import - base: ${base} | target: ${targetLabel(target)}`);
    const products = await importWooBase(base, target, log);
    if (products.length > 0) {
      log?.info(`WooCommerce import collected ${products.length} unique products.`);
      return products;
    }
    log?.warn(`WooCommerce import found no products at ${base}; trying next base if available.`);
  }

  throw new Error(
    'No se trajeron productos desde WooCommerce: la tienda de origen no responde o no expone un catálogo público.',
  );
};
