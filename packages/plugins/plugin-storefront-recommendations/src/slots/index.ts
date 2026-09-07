/**
 * Superficie estable del plugin para el storefront.
 *
 * Los slots son la única superficie que el storefront monta directamente. Los
 * componentes internos (rails, wrappers server-side, cart-slots) se exponen desde acá
 * para que el host los pueda usar con un solo import por unidad de UI:
 *
 *   - `RecommendationsPdpSlot`   → server component: bloque del PDP.
 *   - `RecommendationsCartSlot`  → client component: rail "Te puede interesar".
 *   - `FreeShippingBridgeSlot`   → client component: barra + bridge products.
 *   - `RecentlyViewedRecorder`   → client component: registra la visita (0 render).
 *
 * También se re-exportan los factories del server-side (`createGetRecommendations`,
 * `createGetRecommendationsRoute`, `createRecommendationsEventsRoute`): el host los
 * llama UNA vez para bindear SDK/cookies/getRegion y guardar las funciones resultantes.
 */

export { default as RecommendationsPdpSlot } from '../storefront/modules/recommendations/components/pdp-block';
export {
  CartRecommendations as RecommendationsCartSlot,
  FreeShippingBridge as FreeShippingBridgeSlot,
} from '../storefront/modules/recommendations/components/cart-slots';
export { default as RecentlyViewedRecorder } from '../storefront/modules/recommendations/components/recently-viewed/recorder';
export { default as RecommendationCarousel } from '../storefront/modules/recommendations/components/recommendation-carousel';

export {
  createGetRecommendations,
  type GetRecommendationsDeps,
  type SdkClientLike,
} from '../storefront/data/recommendations';

export type {
  RecommendationContext,
  RecommendationEventName,
  RecommendationPlacement,
  RecommendationRequest,
  RecommendationResponse,
  RecommendedProduct,
  RecommendationVariant,
} from '../storefront/modules/recommendations/types';
