type VariantLike = {
  id: string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  ean?: string | null;
  upc?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ProductLike = {
  id: string;
  title?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  variants?: VariantLike[] | null;
};

export type BarcodeVariantMatch = {
  product_id: string;
  product_title: string | null;
  product_handle: string | null;
  product_thumbnail: string | null;
  variant_id: string;
  variant_title: string | null;
  sku: string | null;
  barcode: string;
};

export const normalizeBarcode = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim().replace(/[\s-]+/g, '').toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const variantBarcodeCandidates = (variant: VariantLike): string[] => {
  const raw = [
    variant.barcode,
    variant.ean,
    variant.upc,
    variant.sku,
    variant.metadata?.barcode,
    variant.metadata?.ean,
    variant.metadata?.upc,
    variant.metadata?.sku,
  ];

  return raw
    .map(normalizeBarcode)
    .filter((value): value is string => Boolean(value));
};

export const findBarcodeVariant = (
  code: string,
  products: ProductLike[],
): BarcodeVariantMatch | null => {
  const target = normalizeBarcode(code);
  if (!target) {
    return null;
  }

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (!variantBarcodeCandidates(variant).includes(target)) {
        continue;
      }

      return {
        product_id: product.id,
        product_title: product.title ?? null,
        product_handle: product.handle ?? null,
        product_thumbnail: product.thumbnail ?? null,
        variant_id: variant.id,
        variant_title: variant.title ?? null,
        sku: variant.sku ?? null,
        barcode: target,
      };
    }
  }

  return null;
};
