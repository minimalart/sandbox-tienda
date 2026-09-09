/**
 * Shared contract for all catalog importers (WooCommerce / VTEX / Shopify).
 *
 * `NormalizedProduct` is the single shape the persistence layer consumes
 * (see persist.ts), regardless of source. It mirrors the original
 * scripts/vtex-fetch.ts shape so the proven import-vtex logic can be reused.
 */
/**
 * One sellable variant of a product (e.g. a size or color). Sources that expose
 * variants (apparel: VTEX SKUs, Shopify variants, Woo variations) populate these
 * so the product is created with a real option dimension instead of collapsing
 * to a single "Único" variant.
 */
export type NormalizedVariant = {
  externalVariantId?: string;
  sku?: string;
  commercial?: import('./commercial').CatalogCommercial;
  /** Variation value shown to the shopper, e.g. "M", "L", "42". */
  value: string;
  /** Barcode for this specific variant/SKU. May be empty. */
  ean: string;
  /** Unit price in minor-unit-free integer (rounded). */
  price: number;
  listPrice: number;
};

export type NormalizedProduct = {
  /** External SKU identity for a single-variant product. */
  externalVariantId?: string;
  /** Source identifier used for dedup (EAN/SKU/handle). May be empty. */
  ean: string;
  productId: string;
  title: string;
  /** Medusa-valid handle: ^[a-z0-9]+(?:-[a-z0-9]+)*$ */
  slug: string;
  description: string;
  brand: string | null;
  /** Hierarchical category path, root → leaf. */
  categoryPath: string[];
  /** Unit price in minor-unit-free integer (rounded). */
  price: number;
  listPrice: number;
  images: string[];
  /** e.g. "carrefour-vtex", "woocommerce", "shopify". */
  source: string;
  /**
   * Variation dimension title, e.g. "Talle". When `variants` has entries this
   * names the product option. Absent/null → single "Formato: Único" fallback.
   */
  optionTitle?: string | null;
  /**
   * Sellable variants (sizes/colors). Absent or empty → the persistence layer
   * falls back to a single "Formato: Único" variant (grocery/single-SKU sources).
   */
  variants?: NormalizedVariant[];
};

export type ImporterLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
};

export type ImporterContext = {
  shouldCancel?: () => Promise<boolean>;
  /** Diagnostics are additive; older adapters may omit them. */
  report?: (report: ImportReport) => void;
  /** Store base URL / domain (e.g. https://mitienda.com). */
  sourceUrl: string;
  /** Per-source params/credentials (Shopify tokens, api version, etc.). */
  sourceConfig?: Record<string, unknown> | null;
  /** Stop once this many unique products are collected. */
  targetCount?: number;
  logger?: ImporterLogger;
};

export type ProductImporter = (ctx: ImporterContext) => Promise<NormalizedProduct[]>;

export type ImportReport = {
  strategy: string;
  complete: boolean;
  reason?: string;
  fetched: number;
  excluded: number;
  excludedSkus?: number;
  estimatedTotal?: number;
  warnings: string[];
};
