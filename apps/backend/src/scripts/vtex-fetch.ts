/**
 * VTEX catalog fetcher (Carrefour Argentina).
 *
 * Walks the public VTEX category tree and paginates the catalog search API to
 * collect a large, de-duplicated set of real products with full fields:
 * title, description, brand, hierarchical category path, ARS price and images.
 *
 * It writes a JSON cache to ./data/vtex-products.json so the import step
 * (import-vtex.ts) is repeatable without hitting VTEX again.
 *
 * Inspired by github.com/matiasbontempo/ratoneando-go, but querying the rich
 * VTEX catalog endpoint directly (ratoneando's normalized schema drops brand,
 * category and description).
 *
 * Run with:
 *   pnpm vtex:fetch
 *   or: dotenv -e .env -- medusa exec ./src/scripts/vtex-fetch.ts
 *
 * Tunables via env:
 *   VTEX_BASE_URL      (default https://www.carrefour.com.ar)
 *   VTEX_TARGET_COUNT  (default 5000)  — stop once this many unique products collected
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Resolved from the backend root (medusa exec runs from there).
const DATA_DIR = join(process.cwd(), 'src', 'scripts', 'data');

const BASE_URL = process.env.VTEX_BASE_URL || 'https://www.carrefour.com.ar';
const TARGET_COUNT = Number(process.env.VTEX_TARGET_COUNT || 5000);
const PAGE_SIZE = 50; // VTEX hard limit: _to - _from <= 49
const OFFSET_CAP = 2500; // VTEX hard limit: _to < 2500 per query
const OUTPUT_FILE = join(DATA_DIR, 'vtex-products.json');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export type NormalizedProduct = {
  ean: string;
  productId: string;
  title: string;
  slug: string;
  description: string;
  brand: string | null;
  categoryPath: string[];
  price: number;
  listPrice: number;
  images: string[];
  source: string;
};

type VtexCategoryNode = {
  id: number;
  name: string;
  hasChildren: boolean;
  children: VtexCategoryNode[];
};

// ── helpers ────────────────────────────────────────────────────────────────

async function fetchJson(url: string, retries = 3): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 206 || res.ok) {
        return await res.json();
      }
      // 404 on an empty page range is a normal "no more results" signal
      if (res.status === 404) return [];
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return [];
}

/** Collect every category id in the tree (parents + leaves). */
function collectCategoryIds(nodes: VtexCategoryNode[], acc: number[] = []): number[] {
  for (const node of nodes) {
    if (node.name.toLowerCase() !== 'test category') acc.push(node.id);
    if (node.children?.length) collectCategoryIds(node.children, acc);
  }
  return acc;
}

/** Strip HTML tags and decode the few entities VTEX descriptions use. */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Map a raw VTEX product into our normalized shape, or null if unusable. */
function normalize(raw: Record<string, any>): NormalizedProduct | null {
  const item = Array.isArray(raw.items) ? raw.items[0] : undefined;
  if (!item) return null;

  const offer = item.sellers?.[0]?.commertialOffer ?? {};
  const price = Number(offer.Price ?? 0);
  const available = Number(offer.AvailableQuantity ?? 0);
  if (price <= 0 || available <= 0) return null; // skip junk / out of stock

  // Some VTEX EANs contain stray internal whitespace — strip it so the same
  // product can't slip through dedup as two distinct EANs.
  const ean: string = String(item.ean || '').replace(/\s+/g, '');
  const productId: string = String(raw.productId ?? '');
  if (!ean && !productId) return null;

  // Deepest category path comes first in VTEX's categories array.
  const rawPath: string = Array.isArray(raw.categories) ? raw.categories[0] ?? '' : '';
  const categoryPath = rawPath
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.toLowerCase() !== 'test category');

  const images: string[] = Array.isArray(item.images)
    ? item.images.map((i: any) => i.imageUrl).filter(Boolean).slice(0, 4)
    : [];

  const title = String(raw.productName ?? '').trim();
  if (!title) return null;

  // Build a handle matching Medusa's isValidHandle: ^[a-z0-9]+(?:-[a-z0-9]+)*$
  // — no leading/trailing/double hyphens. Truncating the title can leave a
  // trailing hyphen, so trim it before joining the (slugified) EAN suffix.
  const titlePart = slugify(title).slice(0, 55).replace(/-+$/, '');
  const idPart = slugify(ean || productId);
  const slug = idPart ? `${titlePart}-${idPart}` : titlePart;

  return {
    ean,
    productId,
    title,
    slug,
    description: stripHtml(String(raw.description ?? raw.metaTagDescription ?? '')),
    brand: raw.brand ? String(raw.brand).trim() : null,
    categoryPath,
    price: Math.round(price),
    listPrice: Math.round(Number(offer.ListPrice ?? price)),
    images,
    source: 'carrefour-vtex',
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

export default async function vtexFetch({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  logger.info('================================================');
  logger.info(`VTEX fetch starting — base: ${BASE_URL} | target: ${TARGET_COUNT}`);
  logger.info('================================================');

  // 1. Category tree (3 levels deep)
  const tree = (await fetchJson(
    `${BASE_URL}/api/catalog_system/pub/category/tree/3`
  )) as VtexCategoryNode[];
  const categoryIds = collectCategoryIds(tree);
  logger.info(`Discovered ${categoryIds.length} categories.`);

  // 2. Round-robin across categories — one page per category per pass — so the
  //    result set is spread across the whole catalog instead of being dominated
  //    by the first few categories. De-dupe by EAN (fallback productId) globally.
  const byKey = new Map<string, NormalizedProduct>();
  const cursors = categoryIds.map((id) => ({ id, from: 0, done: false }));
  let active = cursors.length;
  let pass = 0;

  while (active > 0 && byKey.size < TARGET_COUNT) {
    for (const c of cursors) {
      if (c.done) continue;
      if (c.from >= OFFSET_CAP) {
        c.done = true;
        active--;
        continue;
      }

      const to = Math.min(c.from + PAGE_SIZE - 1, OFFSET_CAP - 1);
      const url = `${BASE_URL}/api/catalog_system/pub/products/search?fq=C:/${c.id}/&_from=${c.from}&_to=${to}`;

      let page: Record<string, any>[];
      try {
        page = (await fetchJson(url)) as Record<string, any>[];
      } catch {
        c.done = true;
        active--;
        continue;
      }

      if (!Array.isArray(page) || page.length === 0) {
        c.done = true;
        active--;
        continue;
      }

      for (const raw of page) {
        const product = normalize(raw);
        if (!product) continue;
        const key = product.ean || `pid-${product.productId}`;
        if (!byKey.has(key)) byKey.set(key, product);
      }

      c.from += PAGE_SIZE;
      if (page.length < PAGE_SIZE) {
        c.done = true;
        active--;
      }
      if (byKey.size >= TARGET_COUNT) break;
    }
    pass++;
    logger.info(`Pass ${pass}: ${byKey.size} unique products (${active} active categories)...`);
  }

  if (byKey.size >= TARGET_COUNT) logger.info(`Reached target ${TARGET_COUNT}.`);

  const products = Array.from(byKey.values());
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(products, null, 2), 'utf-8');

  const withBrand = products.filter((p) => p.brand).length;
  const withDesc = products.filter((p) => p.description).length;
  const withCat = products.filter((p) => p.categoryPath.length).length;

  logger.info('================================================');
  logger.info(`VTEX fetch complete — ${products.length} unique products.`);
  logger.info(`  with brand:       ${withBrand}`);
  logger.info(`  with description: ${withDesc}`);
  logger.info(`  with category:    ${withCat}`);
  logger.info(`  written to:       ${OUTPUT_FILE}`);
  logger.info('================================================');
}
