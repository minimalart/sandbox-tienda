"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  SdkPort,
  CookiesPort,
  LinkPort,
  ProductLookupPort,
  CartStorePort,
} from "../ports/index";

/**
 * Contexto que carga el host UNA vez en el root layout. Los plugins consumen los
 * ports via `useStorefrontShared()` sin importar codigo del host.
 *
 * Si el consumer no lo monto, `useStorefrontShared()` LANZA — un port faltante
 * no se puede fingir con un default; preferimos falla ruidosa en dev.
 */
export interface StorefrontSharedContextValue {
  sdk: SdkPort;
  cookies: CookiesPort;
  link: LinkPort;
  productLookup: ProductLookupPort;
  cartStore: CartStorePort;
}

const StorefrontSharedContext =
  createContext<StorefrontSharedContextValue | null>(null);

export interface StorefrontSharedProviderProps
  extends StorefrontSharedContextValue {
  children: ReactNode;
}

export function StorefrontSharedProvider({
  children,
  ...ports
}: StorefrontSharedProviderProps) {
  return (
    <StorefrontSharedContext.Provider value={ports}>
      {children}
    </StorefrontSharedContext.Provider>
  );
}

export function useStorefrontShared(): StorefrontSharedContextValue {
  const context = useContext(StorefrontSharedContext);
  if (!context) {
    throw new Error(
      "[storefront-shared] useStorefrontShared() se llamo fuera de <StorefrontSharedProvider>. Monta el provider en el root layout del app consumer.",
    );
  }
  return context;
}
