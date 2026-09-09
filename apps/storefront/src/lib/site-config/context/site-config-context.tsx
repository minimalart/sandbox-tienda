"use client";

import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import type { TenantConfig } from "../types";
import { getDefaultTenant } from "../index";
// `withSitePrefix` vive en un módulo neutro para que también lo puedan usar los
// server components y las server actions que hacen redirect().
import { withSitePrefix } from "../site-path";

interface TenantContextType {
  tenant: TenantConfig;
  isLoading: boolean;
  /** Slug del sitio activo (si esta sesión está dentro de una tienda). */
  siteSlug?: string;
  /**
   * Prefijo de path para armar links: `/tienda/moda`, o `''`.
   *
   * Va SEPARADO del slug a propósito. Bajo resolución por subdominio el slug sigue
   * existiendo (se usa para otras cosas) pero el prefijo es `''`, porque el host ya
   * identifica el sitio. Derivar el prefijo del slug — como hacía `useDemoHref` —
   * obligaría a tocar los 22 call sites el día que se prendan los subdominios.
   */
  sitePrefix: string;
}

const TenantContext = createContext<TenantContextType | null>(null);

interface TenantProviderProps {
  children: React.ReactNode;
  tenant: TenantConfig;
  /** Slug del sitio activo, resuelto en el server (`getActiveSiteSlug`). */
  siteSlug?: string;
  /** Prefijo de path, resuelto en el server (`getActiveSitePrefix`). */
  sitePrefix?: string;
}

export const TenantProvider = ({
  children,
  tenant: serverTenant,
  siteSlug,
  sitePrefix,
}: TenantProviderProps) => {
  // NOTA (deuda preexistente, no se toca acá): `useState` CONGELA el tenant en el
  // primer mount y nunca se re-sincroniza si cambia la prop. Con navegación
  // client-side dentro del mismo árbol de provider eso puede mostrar el shell de otro
  // tenant. Hoy no se dispara porque cada identidad de sitio entra por un full load.
  const [tenant] = useState<TenantConfig>(serverTenant);

  return (
    <TenantContext.Provider
      value={{ tenant, isLoading: false, siteSlug, sitePrefix: sitePrefix ?? "" }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantConfig => {
  const context = useContext(TenantContext);
  if (context === null) return getDefaultTenant();
  return context.tenant;
};

/** Slug del sitio activo, o `undefined` en el sitio principal. */
export const useSiteSlug = (): string | undefined => {
  const context = useContext(TenantContext);
  return context?.siteSlug;
};

/** Prefijo de path del sitio activo, o `''`. */
export const useSitePrefix = (): string => {
  const context = useContext(TenantContext);
  return context?.sitePrefix ?? "";
};

/**
 * Versión hook de `withSitePrefix`, que toma el prefijo del contexto.
 *
 * Sus ~22 call sites no necesitan saber NADA de cómo se resuelve el sitio: el día que
 * se prendan los subdominios, el prefijo pasa a `''` y todos se vuelven no-op solos.
 */
export const useSiteHref = (): ((href: string) => string) => {
  const sitePrefix = useSitePrefix();
  // MEMOIZADA: varios call sites la ponen en el dep array de un `useCallback`
  // (`[router, siteHref]`). Sin `useCallback` sería una referencia nueva en cada
  // render y rompería la memoización de esos handlers.
  return useCallback((href: string) => withSitePrefix(href, sitePrefix), [sitePrefix]);
};

/** @deprecated Usar `useSiteSlug`. Alias hasta el PR de cleanup. */
export const useDemoSlug = useSiteSlug;
/** @deprecated Usar `useSiteHref`. Alias hasta el PR de cleanup. */
export const useDemoHref = useSiteHref;

export const useTenantBrand = () => {
  const tenant = useTenant();
  return {
    name: tenant.name,
    logos: tenant.assets.logos,
    banners: tenant.assets.banners,
    heroBanners: tenant.assets.heroBanners,
    featuredCategories: tenant.assets.featuredCategories,
    newArrivals: tenant.assets.newArrivals,
    featuredProducts: tenant.assets.featuredProducts,
    topbar: tenant.assets.topbar,
    favicon: tenant.assets.favicon,
  };
};

export const useTenantTheme = () => {
  const tenant = useTenant();
  return { colors: tenant.theme.colors, typography: tenant.theme.typography };
};

/**
 * Visibilidad de secciones + nombre de blog para el tenant activo (config por
 * demo). Los flags ausentes cuentan como visibles: solo un `false` explícito
 * oculta la sección. Centraliza esa regla para nav/header/mobile-menu.
 */
export const useTenantSections = () => {
  const tenant = useTenant();
  const visibility = tenant.assets.sectionVisibility;
  return {
    blogSectionName: tenant.assets.blogSectionName,
    /** Variante del menú "Categorías" del nav. Ausente = 'hamburger'. */
    categoriesMenuLayout: tenant.assets.categoriesMenuLayout ?? "hamburger",
    /**
     * Orden de preferencia del lugar flexible de la barra inferior mobile. Se
     * expone CRUDO (sin default) porque el default y el filtrado de ids viven
     * en `bottom-nav/slots.ts`, junto al registro de candidatos.
     */
    mobileNav: tenant.assets.mobileNav,
    isBlogVisible: visibility?.blog !== false,
    isCategoriesMenuVisible: visibility?.categories !== false,
    isContactVisible: visibility?.contact !== false,
    isShoppingListVisible: visibility?.shoppingList !== false,
    isSucursalesVisible: visibility?.sucursales !== false,
    isCorporateVisible: visibility?.corporate !== false,
    /** Etiquetas de formato/color en las cards del catálogo. */
    areVariantLabelsVisible: visibility?.variantLabels !== false,
    /**
     * Página "Buscá tu color". Se expone en NEGATIVO a propósito: es la única
     * entrada opt-in de esta lista (sin tintometría no hay nada que mostrar), y
     * un `isTintingVisible` que devolviera `true` por ausencia invitaría a usarlo
     * como si alcanzara para prender el link. Quien lo muestra tiene que combinar
     * esto con el dato real de que la feature existe.
     */
    isTintingHidden: visibility?.tinting === false,
  };
};

export const useTenantChannel = () => {
  const tenant = useTenant();
  return {
    salesChannelId: tenant.medusa.salesChannelId,
    customerGroupId: tenant.medusa.customerGroupId,
    publishableKey: tenant.medusa.publishableKey,
  };
};
