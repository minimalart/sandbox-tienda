/**
 * Public contract for Mercatto catalog importers. Type-only, zero runtime.
 *
 * The host implementation lives in the boilerplate under
 * `packages/extensions/multistore/.../modules/demo-store/catalog/` (normalized
 * shape) and `packages/extensions/store-importer/.../modules/store-importer/
 * importers/` (concrete WooCommerce / VTEX / Shopify strategies). Consumers of
 * this contract MUST NOT import from those paths — they import from this
 * package so the plugin (`@minimalart/mercatto-plugin-store-importer`) and the
 * multistore extension can be versioned and swapped independently.
 *
 * The types below are lifted LITERALLY from the current sources:
 *   - NormalizedProduct, NormalizedVariant, ProductImporter, ImporterContext,
 *     ImporterLogger  →  demo-store/catalog/types.ts
 *   - SourceType, PlatformSourceType  →  demo-store/source-type.ts
 */

// ---------------------------------------------------------------------------
// Catalog normalization (importer output → persistence input)
// ---------------------------------------------------------------------------

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
  /** Variation value shown to the shopper, e.g. "M", "L", "42". */
  value: string;
  /** Barcode for this specific variant/SKU. May be empty. */
  ean: string;
  /** Unit price in minor-unit-free integer (rounded). */
  price: number;
  listPrice: number;
};

export type NormalizedProduct = {
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

/**
 * Minimal logging surface passed to importers. Kept narrow so the plugin can
 * ship without depending on Medusa's logger type.
 */
export type ImporterLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
};

/**
 * Runtime inputs handed to every importer strategy. `sourceConfig` carries
 * per-platform params/credentials (Shopify tokens, VTEX api version, etc.);
 * shape validation is the importer's responsibility.
 */
export type ImporterContext = {
  /** Store base URL / domain (e.g. https://mitienda.com). */
  sourceUrl: string;
  /** Per-source params/credentials (Shopify tokens, api version, etc.). */
  sourceConfig?: Record<string, unknown> | null;
  /** Stop once this many unique products are collected. */
  targetCount?: number;
  logger?: ImporterLogger;
};

/**
 * Signature every catalog importer implements. Returns the normalized batch
 * for the persistence layer to consume.
 */
export type ProductImporter = (ctx: ImporterContext) => Promise<NormalizedProduct[]>;

// ---------------------------------------------------------------------------
// Source classification (used by /admin/sites routes even when the importer
// plugin is absent — see source-type.ts note in the original file)
// ---------------------------------------------------------------------------

/**
 * De dónde viene el catálogo de una tienda.
 *
 * Vive acá y no en `importers/index.ts` para que el paquete `store-importer` pueda
 * ser OPCIONAL: `api/admin/sites/route.ts` y `[id]/retry` necesitan clasificar el
 * origen, pero no necesitan ningún importador. Con la clasificación adentro del
 * importador, sacarlo dejaba esas rutas con imports colgados — y eso no lo atrapa
 * `assertRelativeImportsResolve`, que sólo valida `apps/backend/src/admin`: fallaría
 * recién en el `tsc` del proyecto del cliente.
 *
 * Los tres primeros son plataformas EXTERNAS que se leen por sus endpoints públicos
 * y se normalizan. `sales_channel` es distinto en especie: el catálogo ya vive en
 * esta instancia de Medusa, así que no hay nada que traer — la tienda ADOPTA ese
 * canal y el "import" sólo mide el catálogo.
 */
export type SourceType = 'woocommerce' | 'vtex' | 'shopify' | 'sales_channel';

/** Los orígenes que sí se traen de una plataforma externa con un `ProductImporter`. */
export type PlatformSourceType = Exclude<SourceType, 'sales_channel'>;
