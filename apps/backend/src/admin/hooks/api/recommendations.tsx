import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString } from '../../lib/query-string';

const BASE_URL = '/admin/recommendations';

export type RelationType =
  | 'complementary'
  | 'similar'
  | 'accessory'
  | 'replacement'
  | 'alternative'
  | 'upgrade'
  | 'bought_together'
  | 'viewed_together';

export type StrategyKind =
  | 'manual'
  | 'similar'
  | 'frequently_bought_together'
  | 'trending'
  | 'popular';

export type ProductCard = {
  id: string;
  title: string | null;
  handle: string | null;
  thumbnail: string | null;
  status: string | null;
  sku: string | null;
  price: number | null;
  currency_code: string | null;
  stock: number;
  unlimited_stock: boolean;
};

export type StrategyConfig = {
  lookback_days: number;
  min_orders_analyzed: number;
  min_co_occurrences: number;
  min_confidence: number;
  min_lift: number;
  max_relations_per_source: number;
  max_basket_size: number;
  window_hours: number;
  min_units: number;
  similarity_weights: Record<string, number>;
  candidate_cap: number;
};

export type RecommendationStrategy = {
  id: string;
  key: string;
  name: string;
  kind: StrategyKind;
  enabled: boolean;
  cadence: 'hourly' | 'daily' | 'manual';
  config: Partial<StrategyConfig> | null;
  effective_config: StrategyConfig;
  fallback_chain: string[] | null;
  sales_channel_id: string | null;
  last_built_at: string | null;
  last_status: string | null;
  sort_order: number;
};

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

export type RecommendationPlacement = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  strategy_key: string;
  fallback_chain: string[] | null;
  /** Cadena que realmente va a recorrer el motor (la resuelve el backend). */
  effective_chain: string[];
  result_limit: number;
  candidate_limit: number;
  filters: PlacementFilters | null;
  relation_types: RelationType[] | null;
  sales_channel_id: string | null;
  sort_order: number;
};

export type FreeShippingConfig = {
  enabled: boolean;
  threshold: number | null;
  currency_code: string | null;
  message_in_progress: string;
  message_completed: string;
  show_bridge_products: boolean;
  bridge_product_limit: number;
  bridge_lower_factor: number;
  bridge_upper_factor: number;
};

export type RecommendationsConfig = {
  enabled: boolean;
  default_result_limit: number;
  default_candidate_limit: number;
  max_chain_length: number;
  min_results: number;
  attribution_window_days: number;
  event_ttl_hours: number;
  event_retention_days: number;
  hourly_metric_retention_days: number;
  keep_versions_per_strategy: number;
  free_shipping: FreeShippingConfig;
};

export type RecommendationsConfigResponse = {
  config: RecommendationsConfig;
  defaults: RecommendationsConfig;
  strategy_defaults: StrategyConfig;
  hard_caps: Record<string, number>;
};

export type RecommendationRelation = {
  id: string;
  source_product_id: string;
  target_product_id: string;
  relation_type: RelationType;
  strategy_key: string;
  origin: string;
  priority: number;
  score: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  sales_channel_id: string | null;
  created_at?: string;
  /** `null` = el producto ya no existe (relación huérfana). */
  source_product: ProductCard | null;
  target_product: ProductCard | null;
};

export const RECOMMENDATIONS_QUERY_KEY = ['recommendations'] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// --- Configuración ---------------------------------------------------------

export function useRecommendationsConfig() {
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'config'],
    queryFn: () => fetchJson<RecommendationsConfigResponse>(`${BASE_URL}/config`),
  });
}

export function useUpdateRecommendationsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<RecommendationsConfig>) =>
      fetchJson<{ config: RecommendationsConfig }>(`${BASE_URL}/config`, {
        method: 'POST',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

// --- Estrategias -----------------------------------------------------------

export function useRecommendationStrategies() {
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'strategies'],
    queryFn: () =>
      fetchJson<{ strategies: RecommendationStrategy[]; count: number }>(`${BASE_URL}/strategies`),
  });
}

export function useUpdateRecommendationStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      fetchJson<{ strategy: RecommendationStrategy }>(`${BASE_URL}/strategies/${id}`, {
        method: 'POST',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

// --- Placements ------------------------------------------------------------

export function useRecommendationPlacements() {
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'placements'],
    queryFn: () =>
      fetchJson<{ placements: RecommendationPlacement[]; count: number }>(`${BASE_URL}/placements`),
  });
}

export function useUpdateRecommendationPlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      fetchJson<{ placement: RecommendationPlacement }>(`${BASE_URL}/placements/${id}`, {
        method: 'POST',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

// --- Relaciones manuales ---------------------------------------------------

export type RelationsListParams = {
  source_product_id?: string;
  relation_type?: RelationType;
  is_active?: 'true' | 'false';
  limit?: number;
  offset?: number;
};

export function useRecommendationRelations(params?: RelationsListParams) {
  // `toQueryString` y NUNCA `new URLSearchParams(obj)`: este último stringifica con
  // String(), así que `{ source_product_id: undefined }` se convierte en el literal
  // `source_product_id=undefined` y el backend filtra por ese texto → lista vacía.
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'relations', params ?? {}],
    queryFn: () =>
      fetchJson<{
        relations: RecommendationRelation[];
        count: number;
        offset: number;
        limit: number;
      }>(qs ? `${BASE_URL}/relations?${qs}` : `${BASE_URL}/relations`),
  });
}

export function useCreateRecommendationRelations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      source_product_id: string;
      target_product_ids: string[];
      relation_type: RelationType;
      sales_channel_id?: string | null;
    }) =>
      fetchJson<{ created: number; skipped: number; ignored_self: number }>(
        `${BASE_URL}/relations/bulk`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

export function useUpdateRecommendationRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      fetchJson<{ relation: RecommendationRelation }>(`${BASE_URL}/relations/${id}`, {
        method: 'POST',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

export function useDeleteRecommendationRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/relations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

// --- Buscador de productos -------------------------------------------------

export function useRecommendationProductSearch(params: { q?: string; limit?: number }) {
  const qs = toQueryString(params as Record<string, unknown>);
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'products', params],
    queryFn: () =>
      fetchJson<{ products: ProductCard[]; count: number }>(
        qs ? `${BASE_URL}/products?${qs}` : `${BASE_URL}/products`,
      ),
    // La búsqueda vive mientras el usuario tipea: un poco de cache evita refetchear
    // al volver sobre un término ya consultado.
    staleTime: 30_000,
  });
}

// --- Rendimiento -----------------------------------------------------------

export type PerformanceTotals = {
  served: number;
  served_items: number;
  viewed: number;
  clicked: number;
  added_to_cart: number;
  purchased: number;
  units_purchased: number;
  attributed_revenue: number;
  assisted_revenue: number;
  influenced_orders: number;
  influenced_order_revenue: number;
  ctr: number;
  add_to_cart_rate: number;
  conversion_rate: number;
  influenced_aov: number;
};

export type PerformanceResponse = {
  range: { from: string; to: string; bucket: 'daily' | 'hourly' };
  totals: PerformanceTotals;
  series: Array<{ period: string } & PerformanceTotals>;
  by_placement: Array<{ key: string } & PerformanceTotals>;
  by_strategy: Array<{ key: string } & PerformanceTotals>;
  meta: { source: string; rows_scanned: number; hint: string | null };
};

export type PerformanceParams = {
  from?: string;
  to?: string;
  bucket?: 'daily' | 'hourly';
  placement?: string;
  strategy_key?: string;
  sales_channel_id?: string;
};

export function useRecommendationsPerformance(params?: PerformanceParams) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'performance', params ?? {}],
    queryFn: () =>
      fetchJson<PerformanceResponse>(
        qs ? `${BASE_URL}/performance?${qs}` : `${BASE_URL}/performance`,
      ),
  });
}

export function useAggregateRecommendationMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { bucket?: 'daily' | 'hourly' }) =>
      fetchJson<{ rows_inserted: number }>(`${BASE_URL}/aggregate`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

// --- Versiones (log de corridas) -------------------------------------------

export type RecommendationVersion = {
  id: string;
  strategy_key: string;
  status: 'building' | 'ready' | 'active' | 'superseded' | 'failed';
  triggered_by: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  orders_analyzed: number;
  relations_generated: number;
  relations_discarded: number;
  error_summary: { message?: string; reason?: string } | null;
  created_at: string;
};

export function useRecommendationVersions(params?: { strategy_key?: string; limit?: number }) {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  return useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'versions', params ?? {}],
    queryFn: () =>
      fetchJson<{ versions: RecommendationVersion[]; count: number }>(
        qs ? `${BASE_URL}/versions?${qs}` : `${BASE_URL}/versions`,
      ),
  });
}

export function useRebuildRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { strategy_key?: string }) =>
      fetchJson<{ enqueued: string[]; skipped: Array<{ strategy_key: string; reason: string }> }>(
        `${BASE_URL}/rebuild`,
        { method: 'POST', body: JSON.stringify(body ?? {}) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}

// --- Preview ---------------------------------------------------------------

export type PreviewRequest = {
  placement: string;
  product_id?: string;
  sales_channel_id?: string | null;
  target_price?: number;
};

export type PreviewResponse = {
  placement: string;
  strategy_key: string | null;
  /** Eslabón que efectivamente aportó los productos. */
  resolved_strategy_key: string | null;
  fallback_used: boolean;
  fallback_chain: string[];
  limit: number;
  count: number;
  products: ProductCard[];
  debug: {
    candidates_loaded: number;
    tiers: Array<{ strategy_key: string; candidates: number; eligible: number }>;
    discarded: Record<string, number>;
  } | null;
  error?: string;
};

/**
 * Previsualiza un placement. Es una mutation y no una query a propósito: se dispara
 * con un botón y no debe re-ejecutarse sola: cada preview es una resolución completa
 * del motor contra la base, y hay seis placements en pantalla.
 *
 * No invalida el cache: el preview no muta nada.
 */
export function usePreviewRecommendation() {
  return useMutation({
    mutationFn: (body: PreviewRequest) =>
      fetchJson<PreviewResponse>(`${BASE_URL}/preview`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

// --- Seed ------------------------------------------------------------------

export function useSeedRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ strategies_created: number; placements_created: number }>(`${BASE_URL}/seed`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
}
