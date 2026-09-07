# Changelog

## 0.1.0 - Initial migration from packages/extensions/recommendation-widgets.

- Migra el widget al pattern de plugin publicado en GitHub Packages.
- Consume `@minimalart/mercatto-storefront-shared@^0.1.0` para utils portables + ports.
- Componentes internos refactorizados para NO importar código del host: los ports
  (`SdkPort`, `CookiesPort`, `LinkPort`, `ProductLookupPort`, `CartStorePort`) se
  consumen via `useStorefrontShared()`. Componentes host-coupled (FeaturedProductCard)
  se inyectan como render props (`CardComponent`).
- Route handlers viven en el package (`storefront/api/store/recommendations/`) como
  factories que bindean SDK/cookies/getRegion del host. El storefront usa un shim de
  1-2 líneas en `app/api/store/recommendations/route.ts` y en
  `app/api/store/recommendations/events/route.ts` que re-exporta `GET`/`POST` desde
  `@minimalart/mercatto-plugin-storefront-recommendations/storefront/api/store/recommendations`.
- Server helper `createGetRecommendations({ sdk, cookies, getRegion })` reemplaza el
  `getRecommendations` estático del extension payload: el host lo bindea una sola vez.
- Server components (`RecommendationsPdpSlot`, `FrequentlyBoughtTogetherWrapper`)
  reciben los fetchers server-side por prop (`getRecommendations`, `getProductsByIds`)
  porque no pueden llamar hooks.
