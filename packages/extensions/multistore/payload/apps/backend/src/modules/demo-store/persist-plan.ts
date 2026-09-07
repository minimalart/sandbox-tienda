import type { NormalizedProduct, NormalizedVariant } from './catalog/types';
import { slugify } from './catalog/util';

const VALID_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Option title used when a product has no real variant dimension. */
const FALLBACK_OPTION_TITLE = 'Formato';
const FALLBACK_OPTION_VALUE = 'Unico';

type ProductCreateInput = {
  title: string;
  handle: string;
  description?: string;
  status: 'published';
  thumbnail?: string;
  images: Array<{ url: string }>;
  category_ids: string[];
  options: Array<{ title: string; values: string[] }>;
  variants: Array<{
    title: string;
    sku: string;
    barcode?: string;
    manage_inventory: boolean;
    options: Record<string, string>;
    prices: Array<{ amount: number; currency_code: string }>;
  }>;
  sales_channels: Array<{ id: string }>;
  metadata: Record<string, string | undefined>;
};

export type ProductPlanItem = {
  product: NormalizedProduct;
  input: ProductCreateInput;
};

export type BuildPersistProductPlanInput = {
  products: NormalizedProduct[];
  salesChannelId: string;
  currencyCode: string;
  existingHandles: Set<string>;
  existingSkus: Set<string>;
  /** Barcodes already present on variants in the DB. A variant barcode is only
   * set when the EAN is a real barcode, unique within this import, AND not
   * already used — otherwise the unique-barcode constraint fails the batch. */
  existingBarcodes: Set<string>;
  leafCategoryId: (product: NormalizedProduct) => string | null;
};

const incrementReason = (reasons: Record<string, number>, key: string): void => {
  reasons[key] = (reasons[key] ?? 0) + 1;
};

export function isLikelyBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value);
}

export function skuForProduct(product: NormalizedProduct): string {
  const source = slugify(product.source || 'source') || 'source';
  const identity = slugify(product.productId || product.slug || product.ean) || 'product';
  return `${source}-${identity}`.slice(0, 120);
}

/**
 * The variants to create for a product. Multi-variant sources (apparel) provide
 * `variants`; single-SKU sources (grocery) fall back to one "Único" variant so
 * the persisted shape and SKU stay identical to the legacy behavior.
 *
 * Variant values are deduped (a source occasionally repeats a size across SKUs);
 * the first occurrence wins so its price/barcode are kept.
 */
function effectiveVariants(product: NormalizedProduct): NormalizedVariant[] {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const seen = new Set<string>();
    const out: NormalizedVariant[] = [];
    for (const variant of product.variants) {
      const value = String(variant.value ?? '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push({
        value,
        ean: String(variant.ean ?? '').replace(/\s+/g, ''),
        price: variant.price,
        listPrice: variant.listPrice || variant.price,
      });
    }
    if (out.length > 0) return out;
  }
  return [
    {
      value: FALLBACK_OPTION_VALUE,
      ean: product.ean,
      price: product.price,
      listPrice: product.listPrice,
    },
  ];
}

function optionTitleFor(product: NormalizedProduct, hasRealVariants: boolean): string {
  const title = String(product.optionTitle ?? '').trim();
  if (hasRealVariants && title) return title;
  return FALLBACK_OPTION_TITLE;
}

/** Variant SKU: base SKU for the single-variant case, suffixed per value otherwise. */
function variantSku(baseSku: string, value: string, index: number, hasRealVariants: boolean): string {
  if (!hasRealVariants) return baseSku;
  const suffix = slugify(value) || String(index + 1);
  return `${baseSku}-${suffix}`.slice(0, 120);
}

export function buildPersistProductPlan(input: BuildPersistProductPlanInput): {
  items: ProductPlanItem[];
  skipped: number;
  skippedReasons: Record<string, number>;
} {
  const {
    products,
    salesChannelId,
    currencyCode,
    existingHandles,
    existingSkus,
    existingBarcodes,
    leafCategoryId,
  } = input;
  const currency = currencyCode.toLowerCase();
  const skippedReasons: Record<string, number> = {};
  const seenHandles = new Set<string>();
  const seenSkus = new Set<string>();
  const barcodeCounts = new Map<string, number>();

  // Count barcode candidates across every variant of every product so a barcode
  // shared by two SKUs (within or across products) is dropped rather than failing
  // the unique-barcode constraint mid-batch.
  for (const product of products) {
    for (const variant of effectiveVariants(product)) {
      if (isLikelyBarcode(variant.ean)) {
        barcodeCounts.set(variant.ean, (barcodeCounts.get(variant.ean) ?? 0) + 1);
      }
    }
  }

  const barcodeFor = (ean: string): string | undefined =>
    isLikelyBarcode(ean) && barcodeCounts.get(ean) === 1 && !existingBarcodes.has(ean)
      ? ean
      : undefined;

  const items: ProductPlanItem[] = [];
  for (const product of products) {
    if (!VALID_HANDLE.test(product.slug)) {
      incrementReason(skippedReasons, 'invalid_handle');
      continue;
    }
    if (existingHandles.has(product.slug)) {
      incrementReason(skippedReasons, 'existing_handle');
      continue;
    }
    if (seenHandles.has(product.slug)) {
      incrementReason(skippedReasons, 'duplicate_handle');
      continue;
    }

    const hasRealVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const variants = effectiveVariants(product);
    const baseSku = skuForProduct(product);
    const skus = variants.map((variant, index) =>
      variantSku(baseSku, variant.value, index, hasRealVariants),
    );

    // A product is "already imported" / duplicate if ANY of its variant SKUs
    // collides — keep the dedup at product granularity to avoid half-creating it.
    if (skus.some((sku) => existingSkus.has(sku))) {
      incrementReason(skippedReasons, 'existing_sku');
      continue;
    }
    if (skus.some((sku) => seenSkus.has(sku)) || new Set(skus).size !== skus.length) {
      incrementReason(skippedReasons, 'duplicate_sku');
      continue;
    }

    seenHandles.add(product.slug);
    for (const sku of skus) seenSkus.add(sku);

    const leaf = leafCategoryId(product);
    const optionTitle = optionTitleFor(product, hasRealVariants);

    items.push({
      product,
      input: {
        title: product.title,
        handle: product.slug,
        description: product.description || undefined,
        status: 'published',
        thumbnail: product.images[0] ?? undefined,
        images: product.images.map((url) => ({ url })),
        category_ids: leaf ? [leaf] : [],
        options: [{ title: optionTitle, values: variants.map((variant) => variant.value) }],
        variants: variants.map((variant, index) => ({
          title: variant.value,
          sku: skus[index]!,
          barcode: barcodeFor(variant.ean),
          manage_inventory: false,
          options: { [optionTitle]: variant.value },
          prices: [{ amount: variant.price, currency_code: currency }],
        })),
        sales_channels: [{ id: salesChannelId }],
        metadata: {
          brand: product.brand ?? undefined,
          ean: product.ean || undefined,
          source: product.source,
          // Stable source identity: lets a re-import find & recreate this product
          // even if its title (and therefore its handle) changed at the source.
          source_product_id: product.productId || undefined,
        },
      },
    });
  }

  return {
    items,
    skipped: Object.values(skippedReasons).reduce((sum, count) => sum + count, 0),
    skippedReasons,
  };
}
