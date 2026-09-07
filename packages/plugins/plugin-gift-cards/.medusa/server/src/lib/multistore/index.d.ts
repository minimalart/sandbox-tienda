/**
 * Barrel del shim multistore vendorizado para el plugin shop-by-looks.
 *
 * Se replica lo estrictamente consumido por el plugin (rutas admin + store,
 * descriptor de site-scope). El resto de la superficie del multistore del host
 * (`credentials`, `scoped-routes`, `store-routes`, tests) NO se importa acá — no
 * lo necesita ninguna ruta del plugin y su ausencia mantiene el bundle chico.
 */
export { siteFromRequest, attachSiteHint, siteHintOf, SITE_ID_HEADER, SITE_SLUG_HEADER, ALL_SITES, } from './request';
export { siteFromPublishableKey, siteIdFromPublishableKey, channelsFromPublishableKey, } from './publishable-key';
export { siteFilter, siteColumnFilter, siteDefaults, assertRowInSite, SITE_SCOPE_MAX_IDS, } from './scope';
export type { SiteScopeDescriptor, SiteColumnScope, NullMeans, } from './scope';
export { resolveSite } from './resolve-site';
export type { SiteHint, SiteResolution, SiteRef } from './types';
export { SITE_REGISTRY_MODULE, SITE_REGISTRY_TABLE } from './module-key';
