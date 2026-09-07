import type { RelationType } from './models';

/**
 * Contrato del serve path. Estos tipos los comparten la ruta store, el
 * orquestador y los módulos puros de filtrado/ranking; el storefront espeja la
 * forma de la respuesta en `modules/recommendations/types.ts`.
 */

/** Contexto opcional que manda el storefront (PRD §15.1). */
export type ServeContext = {
  /** Monto faltante para el envío gratis (placement `free-shipping-bridge`). */
  target_price?: number | null;
  /** Banda de precio elegible. Si no viene, se deriva de `target_price`. */
  price_min?: number | null;
  price_max?: number | null;
  /** Candidatos provistos por el cliente (placement `recently-viewed`). */
  product_ids?: string[] | null;
  /** Exclusiones extra pedidas por el cliente (ej. lo que ya está en pantalla). */
  exclude_product_ids?: string[] | null;
  currency_code?: string | null;
};

export type ServeInput = {
  placement: string;
  product_id?: string | null;
  cart_id?: string | null;
  customer_id?: string | null;
  session_id?: string | null;
  sales_channel_id?: string | null;
  region_id?: string | null;
  limit?: number | null;
  context?: ServeContext | null;
};

/** Fila de `recommendation_relation` proyectada por la query de candidatos. */
export type Candidate = {
  target_product_id: string;
  strategy_key: string;
  relation_type: RelationType | string;
  priority: number;
  score: number;
  confidence: number | null;
  co_occurrences: number | null;
  version_id: string | null;
};

export type HydratedVariant = {
  id: string;
  sku: string | null;
  title: string | null;
  manage_inventory: boolean | null;
  calculated_amount: number | null;
  original_amount: number | null;
  currency_code: string | null;
  available: number;
};

/**
 * Producto hidratado por el `query.graph` del serve. Trae exactamente los campos
 * que necesitan los filtros de elegibilidad, ni uno más: el costo de este batch
 * es el 40% del presupuesto de latencia.
 */
export type HydratedProduct = {
  id: string;
  title: string | null;
  handle: string | null;
  thumbnail: string | null;
  status: string | null;
  collection_id: string | null;
  type_id: string | null;
  brand_id: string | null;
  brand_name: string | null;
  /** Incluye las categorías padre, para que "misma categoría" matchee por rama. */
  category_ids: string[];
  tag_values: string[];
  sales_channel_ids: string[];
  metadata: Record<string, unknown> | null;
  variants: HydratedVariant[];
};

/** Filtros configurables del placement (PRD §8, sección "Filtros configurables"). */
export type PlacementFilters = {
  price_min?: number | null;
  price_max?: number | null;
  same_category?: boolean;
  different_category?: boolean;
  same_brand?: boolean;
  excluded_category_ids?: string[];
  required_tags?: string[];
  excluded_tags?: string[];
  metadata_match?: Record<string, unknown>;
};

/** Contexto operativo resuelto para un request (lo que cambia todo el tiempo). */
export type EligibilityContext = {
  source_product_id: string | null;
  source_product: HydratedProduct | null;
  cart_product_ids: ReadonlySet<string>;
  exclude_product_ids: ReadonlySet<string>;
  sales_channel_id: string | null;
};

/**
 * Razones de descarte. Se cuentan una por una porque son la herramienta de
 * diagnóstico del feature: "el widget sale vacío" casi siempre es un filtro
 * comiéndose todo (sin stock, canal equivocado, sin precio para la región), y sin
 * el desglose no hay forma de saber cuál.
 */
export const DISCARD_REASONS = [
  'not_hydrated', // el producto no volvió del query.graph (borrado / no publicado)
  'no_variants',
  'out_of_stock',
  'sales_channel',
  'no_price', // sin precio calculado para la región/moneda del request
  'in_cart',
  'source_product',
  'excluded',
  'price_range',
  'same_category',
  'different_category',
  'same_brand',
  'excluded_category',
  'required_tags',
  'excluded_tags',
  'metadata_match',
  'duplicate',
] as const;

export type DiscardReason = (typeof DISCARD_REASONS)[number];

export type ScoredCandidate = {
  candidate: Candidate;
  product: HydratedProduct;
};

export type FilterOutcome = {
  kept: ScoredCandidate[];
  discarded: Partial<Record<DiscardReason, number>>;
};

/** Un eslabón de la cadena de fallbacks, ya filtrado y ordenado. */
export type ResolvedTier = {
  strategy_key: string;
  kept: ScoredCandidate[];
};

export type ChainResolution = {
  resolved_strategy_key: string | null;
  fallback_used: boolean;
  tier_index: number;
  items: ScoredCandidate[];
};
