/**
 * VTEX catalog importer.
 *
 * Uses public VTEX endpoints. Global search is the primary source because some
 * stores expose a category tree but return no products for leaf category
 * filters. Category search remains a supplement for catalogs that hit the VTEX
 * global offset cap.
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
  fetchJson,
  limitToTarget,
  normalizeTargetCount,
  reachedTarget,
  stripHtml,
  targetLabel,
} from '../../demo-store/catalog/util';

const PAGE_SIZE = 50; // VTEX hard limit: _to - _from <= 49
const OFFSET_CAP = 2500; // VTEX hard limit: _to < 2500 per query

type VtexCategoryNode = {
  id: number;
  name: string;
  hasChildren: boolean;
  children: VtexCategoryNode[];
};

function collectCategoryIds(nodes: VtexCategoryNode[], acc: number[] = []): number[] {
  for (const node of nodes) {
    if (node.name.toLowerCase() !== 'test category') acc.push(node.id);
    if (node.children?.length) collectCategoryIds(node.children, acc);
  }
  return acc;
}

/** Price/stock of a VTEX SKU's first seller, or null if not sellable. */
function offerOf(item: any): { price: number; listPrice: number } | null {
  const offer = item?.sellers?.[0]?.commertialOffer ?? {};
  const price = Number(offer.Price ?? 0);
  const available = Number(offer.AvailableQuantity ?? 0);
  if (price <= 0 || available <= 0) return null;
  return { price: Math.round(price), listPrice: Math.round(Number(offer.ListPrice ?? price)) };
}

/**
 * The variation dimension name for a product, e.g. "Talle"/"Tamanho". The VTEX
 * catalog search exposes per-SKU variation field names in `item.variations`
 * (an array of strings) with the selected value at `item[name]`. We use the
 * first dimension so sizes map to a single product option.
 */
function variationName(item: any): string | null {
  const names = item?.variations;
  if (!Array.isArray(names) || names.length === 0) return null;
  const first = names[0];
  // Newer payloads sometimes use objects ({ name, values }); fall back to .name.
  const name = typeof first === 'string' ? first : String(first?.name ?? '');
  return name.trim() || null;
}

/** Selected value of `dimension` for a SKU (e.g. "M"), or empty string. */
function variationValue(item: any, dimension: string): string {
  const raw = item?.[dimension];
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
  return String(raw ?? '').trim();
}

function normalize(raw: Record<string, any>): NormalizedProduct | null {
  const items: any[] = Array.isArray(raw.items) ? raw.items : [];
  if (items.length === 0) return null;

  // Keep only sellable SKUs (real price + stock), preserving order.
  const sellable = items
    .map((item) => ({ item, offer: offerOf(item) }))
    .filter((entry): entry is { item: any; offer: { price: number; listPrice: number } } =>
      entry.offer !== null,
    );
  if (sellable.length === 0) return null;

  const lead = sellable[0]!;
  const ean = String(lead.item.ean || '').replace(/\s+/g, '');
  const productId = String(raw.productId ?? '').trim();
  if (!productId && !ean) return null;

  const rawPath = Array.isArray(raw.categories) ? raw.categories[0] ?? '' : '';
  const categoryPath = rawPath
    .split('/')
    .map((part: string) => part.trim())
    .filter(Boolean)
    .filter((part: string) => part.toLowerCase() !== 'test category');

  const images: string[] = Array.isArray(lead.item.images)
    ? lead.item.images.map((image: any) => image.imageUrl).filter(Boolean).slice(0, 4)
    : [];

  const title = String(raw.productName ?? '').trim();
  if (!title) return null;

  const slug = buildHandle(title, productId || ean);

  // Build a real size/variant dimension when the SKUs carry one; otherwise the
  // persistence layer falls back to a single "Formato: Único" variant.
  const dimension = variationName(lead.item);
  let optionTitle: string | null = null;
  let variants: NormalizedVariant[] | undefined;
  if (dimension) {
    const built: NormalizedVariant[] = [];
    for (const { item, offer } of sellable) {
      const value = variationValue(item, dimension);
      if (!value) continue;
      built.push({
        value,
        ean: String(item.ean || '').replace(/\s+/g, ''),
        price: offer.price,
        listPrice: offer.listPrice,
      });
    }
    if (built.length > 0) {
      optionTitle = dimension;
      variants = built;
    }
  }

  return {
    ean,
    productId,
    title,
    slug,
    description: stripHtml(String(raw.description ?? raw.metaTagDescription ?? '')),
    brand: raw.brand ? String(raw.brand).trim() : null,
    categoryPath,
    price: lead.offer.price,
    listPrice: lead.offer.listPrice,
    images,
    source: 'vtex',
    optionTitle,
    variants,
  };
}

function productKey(product: NormalizedProduct): string {
  return product.productId ? `pid-${product.productId}` : `ean-${product.ean}`;
}

async function addSearchPage(
  url: string,
  byKey: Map<string, NormalizedProduct>,
): Promise<number> {
  const page = (await fetchJson(url)) as Record<string, any>[];
  if (!Array.isArray(page) || page.length === 0) return 0;
  for (const raw of page) {
    const product = normalize(raw);
    if (!product) continue;
    const key = productKey(product);
    if (!byKey.has(key)) byKey.set(key, product);
  }
  return page.length;
}

async function importGlobalSearch(
  base: string,
  byKey: Map<string, NormalizedProduct>,
  target: number | undefined,
): Promise<void> {
  for (let from = 0; from < OFFSET_CAP && !reachedTarget(byKey.size, target); from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, OFFSET_CAP - 1);
    const count = await addSearchPage(
      `${base}/api/catalog_system/pub/products/search?_from=${from}&_to=${to}`,
      byKey,
    );
    if (count < PAGE_SIZE) break;
  }
}

async function importCategorySearch(
  base: string,
  categoryIds: number[],
  byKey: Map<string, NormalizedProduct>,
  target: number | undefined,
): Promise<void> {
  const cursors = categoryIds.map((id) => ({ id, from: 0, done: false }));
  let active = cursors.length;

  while (active > 0 && !reachedTarget(byKey.size, target)) {
    for (const cursor of cursors) {
      if (cursor.done) continue;
      if (cursor.from >= OFFSET_CAP) {
        cursor.done = true;
        active--;
        continue;
      }

      const to = Math.min(cursor.from + PAGE_SIZE - 1, OFFSET_CAP - 1);
      const count = await addSearchPage(
        `${base}/api/catalog_system/pub/products/search?fq=C:/${cursor.id}/&_from=${cursor.from}&_to=${to}`,
        byKey,
      ).catch(() => 0);

      cursor.from += PAGE_SIZE;
      if (count < PAGE_SIZE) {
        cursor.done = true;
        active--;
      }
      if (reachedTarget(byKey.size, target)) break;
    }
  }
}

async function importVtexBase(
  base: string,
  target: number | undefined,
  log: ImporterContext['logger'],
): Promise<NormalizedProduct[]> {
  const tree = (await fetchJson(
    `${base}/api/catalog_system/pub/category/tree/3`,
  )) as VtexCategoryNode[];
  const categoryIds = collectCategoryIds(Array.isArray(tree) ? tree : []);
  log?.info(`Discovered ${categoryIds.length} VTEX categories.`);

  const byKey = new Map<string, NormalizedProduct>();
  await importGlobalSearch(base, byKey, target);

  if (!reachedTarget(byKey.size, target) && categoryIds.length > 0) {
    await importCategorySearch(base, categoryIds, byKey, target);
  }

  return limitToTarget(Array.from(byKey.values()), target);
}

export const vtexImporter: ProductImporter = async (ctx: ImporterContext) => {
  const target = normalizeTargetCount(ctx.targetCount);
  const log = ctx.logger;

  for (const base of baseUrlCandidates(ctx.sourceUrl)) {
    log?.info(`VTEX import - base: ${base} | target: ${targetLabel(target)}`);
    const products = await importVtexBase(base, target, log);
    if (products.length > 0) {
      log?.info(`VTEX import collected ${products.length} unique products.`);
      return products;
    }
    log?.warn(`VTEX import found no products at ${base}; trying next base if available.`);
  }

  throw new Error('No se trajeron productos desde VTEX: la tienda de origen no expone un catálogo público vendible.');
};
