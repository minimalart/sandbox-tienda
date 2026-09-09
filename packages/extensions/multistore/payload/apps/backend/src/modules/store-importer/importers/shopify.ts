/**
 * Shopify catalog importer.
 *
 * Escalating strategy (picks the first that applies, based on source_config):
 *  1. PUBLIC, no token (default): GET {base}/products.json?limit=250&page=N.
 *     Returns products published to the online store — enough for a demo and
 *     aligned with the PRD's "no admin access" principle.
 *  2. Storefront API (public token): POST {base}/api/{version}/graphql.json with
 *     X-Shopify-Storefront-Access-Token when `storefront_access_token` is set.
 *  3. Admin GraphQL (private token): last resort for the full internal catalog,
 *     when `admin_access_token` is set.
 */
import type {
  ImporterContext,
  NormalizedProduct,
  NormalizedVariant,
  ProductImporter,
} from '../../../lib/catalog/types';
import {
  buildHandle,
  limitToTarget,
  normalizeBaseUrl,
  normalizeTargetCount,
  reachedTarget,
  resilientFetch,
  stripHtml,
} from '../../../lib/catalog/legacy-util';

const PER_PAGE = 250;
const DEFAULT_API_VERSION = '2025-01';

function round(n: unknown): number {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

// ── 1. Public /products.json ────────────────────────────────────────────────

type ShopifyRestVariant = {
  id?: number;
  price?: string;
  compare_at_price?: string;
  sku?: string;
  barcode?: string;
  option1?: string;
};
type ShopifyRestOption = { name?: string };
type ShopifyRestImage = { src?: string };
type ShopifyRestProduct = {
  id: number;
  title: string;
  handle?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  options?: ShopifyRestOption[];
  variants?: ShopifyRestVariant[];
  images?: ShopifyRestImage[];
};

function normalizeRest(raw: ShopifyRestProduct): NormalizedProduct | null {
  const title = String(raw.title ?? '').trim();
  if (!title) return null;
  const variant = raw.variants?.[0];
  const price = round(variant?.price);
  if (price <= 0) return null;

  const sku = String(variant?.sku ?? '').replace(/\s+/g, '');
  const productId = String(raw.id ?? '');
  const slug = raw.handle ? buildHandle(raw.handle, '') || buildHandle(title, productId) : buildHandle(title, productId);

  // Shopify's first option (e.g. "Size") with variant.option1 as the value.
  // Skip the synthetic "Title / Default Title" option Shopify gives single-variant
  // products so they keep the "Formato: Único" fallback.
  const optionName = String(raw.options?.[0]?.name ?? '').trim();
  let optionTitle: string | null = null;
  let variants: NormalizedVariant[] | undefined;
  if (optionName && optionName.toLowerCase() !== 'title') {
    const built: NormalizedVariant[] = [];
    for (const v of raw.variants ?? []) {
      const value = String(v.option1 ?? '').trim();
      const vPrice = round(v.price);
      if (!value || value.toLowerCase() === 'default title' || vPrice <= 0) continue;
      built.push({
        externalVariantId: v.id == null ? undefined : String(v.id),
        value,
        ean: String(v.barcode ?? '').replace(/\s+/g, ''),
        price: vPrice,
        listPrice: round(v.compare_at_price) || vPrice,
      });
    }
    if (built.length > 0) {
      optionTitle = optionName;
      variants = built;
    }
  }

  return {
    ean: sku,
    externalVariantId: variant?.id == null ? undefined : String(variant.id),
    productId,
    title,
    slug,
    description: stripHtml(String(raw.body_html ?? '')),
    brand: raw.vendor ? String(raw.vendor).trim() : null,
    categoryPath: raw.product_type ? [String(raw.product_type).trim()] : [],
    price,
    listPrice: round(variant?.compare_at_price) || price,
    images: (raw.images ?? []).map((i) => i.src).filter((s): s is string => !!s).slice(0, 4),
    source: 'shopify',
    optionTitle,
    variants,
  };
}

async function importPublicRest(
  base: string,
  target: number | undefined,
): Promise<NormalizedProduct[]> {
  const byKey = new Map<string, NormalizedProduct>();
  let page = 1;
  while (!reachedTarget(byKey.size, target)) {
    const url = `${base}/products.json?limit=${PER_PAGE}&page=${page}`;
    const res = await resilientFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      if (page === 1) throw new Error(`Shopify public products.json HTTP ${res.status}`);
      break;
    }
    const body = (await res.json()) as { products?: ShopifyRestProduct[] };
    const list = body.products ?? [];
    if (list.length === 0) break;
    for (const raw of list) {
      const product = normalizeRest(raw);
      if (!product) continue;
      const key = product.ean || `pid-${product.productId}`;
      if (!byKey.has(key)) byKey.set(key, product);
    }
    if (list.length < PER_PAGE) break;
    page++;
  }
  return limitToTarget(Array.from(byKey.values()), target);
}

// ── 2 & 3. GraphQL (Storefront public token / Admin private token) ────────────

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 250, after: $cursor) {
      edges {
        node {
          id
          title
          handle
          description
          vendor
          productType
          options { name }
          images(first: 4) { edges { node { url } } }
          variants(first: 100) {
            edges {
              node {
                sku
                barcode
                price { amount }
                compareAtPrice { amount }
                selectedOptions { name value }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

const amount = (value: any): number => round(value?.amount ?? value);

function normalizeGraphql(node: any): NormalizedProduct | null {
  const title = String(node?.title ?? '').trim();
  if (!title) return null;
  const variant = node?.variants?.edges?.[0]?.node;
  const price = amount(variant?.price);
  if (price <= 0) return null;

  const sku = String(variant?.sku ?? '').replace(/\s+/g, '');
  const productId = String(node?.id ?? '').split('/').pop() ?? '';
  const slug = node?.handle ? buildHandle(node.handle, '') || buildHandle(title, productId) : buildHandle(title, productId);

  // First option dimension (e.g. "Size"); skip Shopify's synthetic "Title" so
  // single-variant products keep the "Formato: Único" fallback.
  const optionName = String(node?.options?.[0]?.name ?? '').trim();
  let optionTitle: string | null = null;
  let variants: NormalizedVariant[] | undefined;
  if (optionName && optionName.toLowerCase() !== 'title') {
    const built: NormalizedVariant[] = [];
    for (const edge of node?.variants?.edges ?? []) {
      const v = edge?.node;
      const value = String(
        v?.selectedOptions?.find((o: any) => String(o?.name ?? '').trim() === optionName)?.value ??
          v?.selectedOptions?.[0]?.value ??
          '',
      ).trim();
      const vPrice = amount(v?.price);
      if (!value || value.toLowerCase() === 'default title' || vPrice <= 0) continue;
      built.push({
        externalVariantId: v.id == null ? undefined : String(v.id),
        value,
        ean: String(v?.barcode ?? '').replace(/\s+/g, ''),
        price: vPrice,
        listPrice: amount(v?.compareAtPrice) || vPrice,
      });
    }
    if (built.length > 0) {
      optionTitle = optionName;
      variants = built;
    }
  }

  return {
    ean: sku,
    externalVariantId: variant?.id == null ? undefined : String(variant.id),
    productId,
    title,
    slug,
    description: stripHtml(String(node?.description ?? '')),
    brand: node?.vendor ? String(node.vendor).trim() : null,
    categoryPath: node?.productType ? [String(node.productType).trim()] : [],
    price,
    listPrice: amount(variant?.compareAtPrice) || price,
    images: (node?.images?.edges ?? []).map((e: any) => e?.node?.url).filter(Boolean).slice(0, 4),
    source: 'shopify',
    optionTitle,
    variants,
  };
}

async function importGraphql(
  endpoint: string,
  headers: Record<string, string>,
  target: number | undefined,
): Promise<NormalizedProduct[]> {
  const byKey = new Map<string, NormalizedProduct>();
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext && !reachedTarget(byKey.size, target)) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { cursor } }),
    });
    if (!res.ok) throw new Error(`Shopify GraphQL HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (json.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors)}`);

    const conn = json?.data?.products;
    for (const edge of conn?.edges ?? []) {
      const product = normalizeGraphql(edge?.node);
      if (!product) continue;
      const key = product.ean || `pid-${product.productId}`;
      if (!byKey.has(key)) byKey.set(key, product);
    }
    hasNext = !!conn?.pageInfo?.hasNextPage;
    cursor = conn?.pageInfo?.endCursor ?? null;
  }
  return limitToTarget(Array.from(byKey.values()), target);
}

export const shopifyImporter: ProductImporter = async (ctx: ImporterContext) => {
  const base = normalizeBaseUrl(ctx.sourceUrl);
  const target = normalizeTargetCount(ctx.targetCount);
  const cfg = (ctx.sourceConfig ?? {}) as Record<string, string | undefined>;
  const apiVersion = cfg.api_version || DEFAULT_API_VERSION;
  const log = ctx.logger;

  let products: NormalizedProduct[];

  if (cfg.admin_access_token) {
    log?.info(`Shopify import — Admin GraphQL (${apiVersion}).`);
    products = await importGraphql(
      `${base}/admin/api/${apiVersion}/graphql.json`,
      { 'X-Shopify-Access-Token': cfg.admin_access_token },
      target,
    );
  } else if (cfg.storefront_access_token) {
    log?.info(`Shopify import — Storefront API (${apiVersion}).`);
    products = await importGraphql(
      `${base}/api/${apiVersion}/graphql.json`,
      { 'X-Shopify-Storefront-Access-Token': cfg.storefront_access_token },
      target,
    );
  } else {
    log?.info('Shopify import — public products.json (no token).');
    products = await importPublicRest(base, target);
  }

  log?.info(`Shopify import collected ${products.length} unique products.`);
  return products;
};
