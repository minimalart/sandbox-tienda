'use client';

import type { ReactNode } from 'react';
import { StorefrontSharedProvider } from '@minimalart/mercatto-storefront-shared/provider';
import type {
  CartStorePort,
  CookiesPort,
  LinkPort,
  ProductLookupPort,
  SdkPort,
} from '@minimalart/mercatto-storefront-shared/ports';
import { sdk } from './config';
import { useCartStore } from './stores/cart.store';
import LocalizedClientLink from '../modules/common/components/localized-client-link';

/**
 * Wrapper Client Component del `StorefrontSharedProvider`.
 *
 * ─── POR QUÉ NO ES UN ARCHIVO DE WIRING PURO ─────────────────────────────────
 *
 * El root layout de Next.js es un Server Component. Pasarle `sdk` (instancia de
 * clase Medusa) o funciones no-serializables como props al provider (que es
 * client) cruza el boundary RSC → tira `Only plain objects, and a few built-ins,
 * can be passed to Client Components from Server Components. Classes or null
 * prototypes are not supported.` en `next build`. Precedente: deploy Vercel
 * 2026-09-03 rompió con exactamente ese error.
 *
 * Solución: los ports se instancian DENTRO de este archivo (Client Component
 * completo). El root layout solo hace `<StorefrontSharedProviders>{children}</...>`
 * sin cruzar nada por props.
 *
 * ─── QUÉ SE INYECTA CLIENT-SIDE, QUÉ NO ──────────────────────────────────────
 *
 * El provider provee ports client-safe: `sdk` (fetch cliente), `link` (renderer
 * de link localizado), `cartStore` (zustand selector). Estos son los que los
 * componentes del plugin consumen via `useStorefrontShared()`.
 *
 * `cookies` y `productLookup` son SERVER-ONLY: los helpers de `next/headers`
 * solo corren en Server Components / route handlers, no en client. Los
 * consumidores server-side (API routes, server components como `RecommendationsPdpSlot`)
 * inyectan sus versiones inline via factories (`createGetRecommendationsRoute`,
 * `createGetRecommendations`) que reciben cookies+sdk+getRegion como argumentos.
 * Acá los declaramos con un throw defensivo para que un client component que
 * accidentalmente los consuma explote con un mensaje útil en dev.
 */

const sdkPort: SdkPort = sdk as unknown as SdkPort;

const linkPort: LinkPort = {
  render: ({ href, className, children }: { href: string; className?: string; children: ReactNode }) => (
    <LocalizedClientLink href={href} className={className}>
      {children}
    </LocalizedClientLink>
  ),
};

const cartStorePort: CartStorePort<unknown> = {
  useCartStore: useCartStore as unknown as CartStorePort<unknown>['useCartStore'],
};

const serverOnlyError = (portName: string) => () => {
  throw new Error(
    `[storefront-shared] ${portName} es server-only. Los client components no pueden leer cookies de next/headers ni ejecutar hidratación de productos; usá la SDK directa (via useStorefrontShared().sdk) o mové la llamada a un API route / server component que reciba las factories del plugin con sus propias implementaciones inline.`,
  );
};

const cookiesPort: CookiesPort = {
  getCartId: serverOnlyError('CookiesPort.getCartId'),
  getActiveSalesChannelId: serverOnlyError('CookiesPort.getActiveSalesChannelId'),
  getAuthHeaders: serverOnlyError('CookiesPort.getAuthHeaders'),
};

const productLookupPort: ProductLookupPort = {
  getProductsByIds: serverOnlyError('ProductLookupPort.getProductsByIds'),
};

export function StorefrontSharedProviders({ children }: { children: ReactNode }) {
  return (
    <StorefrontSharedProvider
      sdk={sdkPort}
      cookies={cookiesPort}
      link={linkPort}
      productLookup={productLookupPort}
      cartStore={cartStorePort}
    >
      {children}
    </StorefrontSharedProvider>
  );
}
