# @minimalart/mercatto-plugin-storefront-recommendations

Mercatto storefront plugin — product recommendations. Migrado desde
`packages/extensions/recommendation-widgets`. Ships:

- **Slots** (React components): `RecommendationsPdpSlot`, `RecommendationsCartSlot`,
  `FreeShippingBridgeSlot`, `RecentlyViewedRecorder`, `RecommendationCarousel`.
- **Route handler factories** (Next.js App Router): `createGetRecommendationsRoute`,
  `createRecommendationsEventsRoute`.
- **Server data factory**: `createGetRecommendations` (para render en server components
  del host — ej. RelatedProducts / SameCategoryProducts que consumen el motor).

El plugin NO importa código del host. Todo lo host-coupled entra vía:

- **Ports** de `@minimalart/mercatto-storefront-shared/provider` (SDK, cookies, link,
  cart store) — consumidos con `useStorefrontShared()` dentro de client components.
- **Render props** para deps no portables:
  - `CardComponent` (typicamente `FeaturedProductCard` del storefront) — inyectada al
    rail para renderizar cada card sin liftear su árbol de dependencias.
- **Server-side deps por prop**: los componentes de servidor (`RecommendationsPdpSlot`,
  `FrequentlyBoughtTogetherWrapper`) reciben `getRecommendations` y `getProductsByIds`
  como props porque no pueden llamar hooks.

## Peer requirements

- `react`, `react-dom`, `next`
- `@medusajs/js-sdk`, `@medusajs/types`, `@medusajs/ui`
- `@minimalart/mercatto-storefront-shared@^0.1.0`

## Setup del host (PR-C)

### 1. Root layout — montar el provider

```tsx
// apps/storefront/src/app/[countryCode]/layout.tsx
import { StorefrontSharedProvider } from '@minimalart/mercatto-storefront-shared/provider';
import { sdk } from '@lib/config';
import * as cookies from '@lib/data/cookies';
import { getProductsByIds } from '@lib/data/products';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import { useCartStore } from '@lib/stores/cart.store';

// ports: SDK, cookies, link, productLookup, cartStore
<StorefrontSharedProvider
  sdk={sdk}
  cookies={cookies}
  link={{
    render: ({ href, className, children }) => (
      <LocalizedClientLink href={href} className={className}>
        {children}
      </LocalizedClientLink>
    ),
  }}
  productLookup={{ getProductsByIds: (ids) => getProductsByIds({ productIds: ids, countryCode: '...' }) }}
  cartStore={{ useCartStore }}
>
  {children}
</StorefrontSharedProvider>
```

### 2. Route handler shims

```ts
// apps/storefront/src/app/api/store/recommendations/route.ts
import { createGetRecommendationsRoute } from '@minimalart/mercatto-plugin-storefront-recommendations/storefront/api/store/recommendations';
import { sdk } from '@lib/config';
import * as cookies from '@lib/data/cookies';
import { getRegion } from '@lib/data/regions';

export const { GET } = createGetRecommendationsRoute({ sdk, cookies, getRegion });
```

```ts
// apps/storefront/src/app/api/store/recommendations/events/route.ts
import { createRecommendationsEventsRoute } from '@minimalart/mercatto-plugin-storefront-recommendations/storefront/api/store/recommendations/events';
import { sdk } from '@lib/config';
import * as cookies from '@lib/data/cookies';

export const { POST } = createRecommendationsEventsRoute({ sdk, cookies });
```

### 3. Server helper para PDP / rails de servidor

```ts
// apps/storefront/src/lib/data/recommendations.ts
import 'server-only';
import { createGetRecommendations } from '@minimalart/mercatto-plugin-storefront-recommendations';
import { sdk } from '@lib/config';
import * as cookies from '@lib/data/cookies';
import { getRegion } from '@lib/data/regions';

export const getRecommendations = createGetRecommendations({ sdk, cookies, getRegion });
```

### 4. Montaje de slots

```tsx
// PDP: apps/storefront/src/lib/recommendations-slot.tsx
import { RecommendationsPdpSlot } from '@minimalart/mercatto-plugin-storefront-recommendations/slots';
import FeaturedProductCard from '@modules/home/components/featured-product-card';
import { getRecommendations } from '@lib/data/recommendations';
import { getProductsByIds } from '@lib/data/products';

export function RecommendationsPdp(props) {
  return (
    <RecommendationsPdpSlot
      {...props}
      getRecommendations={getRecommendations}
      getProductsByIds={getProductsByIds}
      CardComponent={FeaturedProductCard}
    />
  );
}
```

```tsx
// Cart drawer: apps/storefront/src/lib/recommendations-cart-slot.tsx
'use client';
import {
  RecommendationsCartSlot,
  FreeShippingBridgeSlot,
} from '@minimalart/mercatto-plugin-storefront-recommendations/slots';
import FeaturedProductCard from '@modules/home/components/featured-product-card';

export function CartRecommendations(props) {
  return <RecommendationsCartSlot {...props} CardComponent={FeaturedProductCard} />;
}
export function FreeShippingBridge(props) {
  return <FreeShippingBridgeSlot {...props} CardComponent={FeaturedProductCard} />;
}
```
