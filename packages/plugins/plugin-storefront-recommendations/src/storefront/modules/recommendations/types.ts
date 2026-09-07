/**
 * CONTRATO con el motor de recomendaciones del backend.
 *
 * Este archivo es la frontera entre las dos extensiones (`recommendation-engine` y
 * `recommendation-widgets`). Los slugs de placement, los nombres de evento y la forma
 * de `context` tienen que coincidir con
 * `apps/backend/src/modules/recommendations/types.ts`: si divergen, no lo caza el
 * compilador —son strings a través de HTTP— y el síntoma es un widget vacío o eventos
 * rechazados en silencio.
 *
 * Sin directiva a propósito: lo importan componentes de servidor y de cliente.
 */

/** Placements de la V1 (PRD §11.3). */
export type RecommendationPlacement =
  | 'product-detail-similar'
  | 'product-detail-complementary'
  | 'product-detail-fbt'
  | 'cart-recommendations'
  | 'free-shipping-bridge'
  | 'recently-viewed';

/** Eventos que el cliente puede reportar. `served` y `purchased` los escribe el backend. */
export type RecommendationEventName =
  | 'recommendation_viewed'
  | 'recommendation_clicked'
  | 'recommendation_added_to_cart';

export type RecommendationContext = {
  /** Monto faltante para el envío gratis (placement `free-shipping-bridge`). */
  target_price?: number;
  price_min?: number;
  price_max?: number;
  /** Candidatos que aporta el cliente (placement `recently-viewed`). */
  product_ids?: string[];
  exclude_product_ids?: string[];
  currency_code?: string;
};

export type RecommendationVariant = {
  id: string;
  sku: string | null;
  title: string | null;
  calculated_amount: number | null;
  original_amount: number | null;
  currency_code: string | null;
  available: number;
};

export type RecommendedProduct = {
  product_id: string;
  title: string | null;
  handle: string | null;
  thumbnail: string | null;
  position: number;
  score: number;
  relation_type: string;
  strategy_key: string;
  price: number | null;
  currency_code: string | null;
  reason: { confidence: number | null; co_occurrences: number | null } | null;
  variants: RecommendationVariant[];
};

export type RecommendationResponse = {
  /** `null` cuando el motor no está disponible: no se dispara ningún evento. */
  request_id: string | null;
  placement: string;
  strategy_key: string | null;
  resolved_strategy_key: string | null;
  fallback_used: boolean;
  fallback_chain: string[];
  version_id: string | null;
  limit: number;
  count: number;
  products: RecommendedProduct[];
};

export type RecommendationRequest = {
  placement: RecommendationPlacement;
  product_id?: string;
  cart_id?: string;
  limit?: number;
  context?: RecommendationContext;
  country_code?: string;
};

/** Respuesta vacía bien formada, para los caminos degradados. */
export const emptyRecommendationResponse = (placement: string): RecommendationResponse => ({
  request_id: null,
  placement,
  strategy_key: null,
  resolved_strategy_key: null,
  fallback_used: false,
  version_id: null,
  fallback_chain: [],
  limit: 0,
  count: 0,
  products: [],
});
