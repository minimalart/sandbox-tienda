/**
 * Ports: interfaces por las que un plugin storefront pide al host lo que NO es
 * portable. El host implementa los ports y los inyecta via
 * `<StorefrontSharedProvider>`; el plugin los consume via `useStorefrontShared()`.
 *
 * --- QUE VA ACA vs. QUE ES `dependencies` ----------------------------------
 *
 * `zustand`, utils puros (money, is-in-stock) -> van compilados en el paquete,
 * son sin coupling con el host. `dependencies`.
 *
 * SDK config, cookies con activeTenant/site scope, resolucion de link
 * localizado, hidratacion de product con reglas de negocio del tenant -> NO son
 * portables (cambian por tenant, requieren el context de la app consumer).
 * Van como ports. El plugin recibe una interfaz minima; el host la satisface
 * con lo que ya tiene en `apps/storefront/src/lib/*` sin publicarlo.
 */

import type { HttpTypes } from "@medusajs/types";
import type { ReactElement, ReactNode } from "react";

/** SDK inyectado por el host, con la config del tenant activo. */
export interface SdkPort {
  admin?: unknown;
  store: {
    product: {
      list(
        query: HttpTypes.StoreProductParams,
      ): Promise<HttpTypes.StoreProductListResponse>;
    };
    cart?: unknown;
  };
}

/** Cookies del server side — `getCartId`, `getActiveSalesChannelId`, `getAuthHeaders`. */
export interface CookiesPort {
  getCartId(): Promise<string | null>;
  getActiveSalesChannelId(): Promise<string | null>;
  getAuthHeaders(): Promise<Record<string, string>>;
}

/** Renderer de link localizado (`LocalizedClientLink` del host). */
export interface LinkPort {
  render(props: {
    href: string;
    className?: string;
    children: ReactNode;
  }): ReactElement;
}

/** Busqueda de productos por id, resolviendo variantes con las reglas de negocio del host. */
export interface ProductLookupPort {
  getProductsByIds(ids: string[]): Promise<HttpTypes.StoreProduct[]>;
}

/** Store del carrito (Zustand-compatible). El plugin lee via selector. */
export interface CartStorePort<T = unknown> {
  useCartStore<U>(selector: (state: T) => U): U;
}
