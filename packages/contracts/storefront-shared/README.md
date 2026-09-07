# @minimalart/mercatto-storefront-shared

Storefront-side shared primitives for Mercatto. Portable utils (money, stock, get-individual-variant), presentational components (checkbox-input, scroll-carousel, product-image), a recently-viewed Zustand store, and a **ports + provider** contract that Mercatto storefront plugins consume without pulling the whole host tree.

## What lives here vs. what stays in the host

**Here (portable):** pure functions, presentational components with no tenant/site-config coupling, the recently-viewed store.

**Ports (host provides):** `SdkPort`, `CookiesPort`, `LinkPort`, `ProductLookupPort`, `CartStorePort`. See `src/ports/index.ts`. The host wires them once in the root layout via `<StorefrontSharedProvider>`.

## Consumer pattern

Root layout of the consumer app:

```tsx
import { StorefrontSharedProvider } from '@minimalart/mercatto-storefront-shared/provider';
import { sdk, cookies, link, productLookup, cartStore } from './wiring';

export default function RootLayout({ children }) {
  return (
    <StorefrontSharedProvider sdk={sdk} cookies={cookies} link={link} productLookup={productLookup} cartStore={cartStore}>
      {children}
    </StorefrontSharedProvider>
  );
}
```

Plugin code:

```tsx
import { useStorefrontShared } from '@minimalart/mercatto-storefront-shared/provider';
import { convertToLocale } from '@minimalart/mercatto-storefront-shared/util/money';

const { sdk, cookies } = useStorefrontShared();
```

## Publish

Registry: `https://npm.pkg.github.com` (restricted). Version bumps follow semver; breaking port shape changes are MAJOR.
