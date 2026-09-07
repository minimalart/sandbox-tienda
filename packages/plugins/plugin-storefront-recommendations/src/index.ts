/**
 * Root barrel para @minimalart/mercatto-plugin-storefront-recommendations.
 *
 * Consumers importan:
 *   - Slots (`RecommendationsPdpSlot`, `RecommendationsCartSlot`, `FreeShippingBridgeSlot`,
 *     `RecentlyViewedRecorder`) desde `./slots`.
 *   - Route handlers factories desde `./storefront/api/store/recommendations` y
 *     `./storefront/api/store/recommendations/events`.
 *   - Server data factory (`createGetRecommendations`) también desde `./slots`.
 *
 * Componentes internos NO se re-exportan del root: los slots son la superficie estable.
 * Si algún día un caller externo necesita un componente puntual, se agrega un subpath
 * export explícito en `package.json`.
 */
export * from './slots';
