/**
 * Seam multitienda — superficie pública, vendorizada en este plugin.
 *
 * Este archivo es un espejo REDUCIDO de `apps/backend/src/lib/multistore/index.ts`:
 * solo re-exporta las piezas que consumen los handlers de este plugin. Vendorizarlas
 * al lado del código que las usa evita que un import cuelgue del host cuando el
 * plugin se instala en un proyecto de cliente (`resolve-ownership.js` NO copia
 * `src/lib/multistore/` a proyectos de cliente si no hay extensiones que lo
 * pidan — el plugin no es una extensión, es una dependencia npm).
 *
 * Convergencia futura: los plugins Tier A comparten esta superficie; cuando exista
 * `@minimalart/mercatto-plugin-runtime`, esta capa se reemplaza por un import de
 * runtime y estos archivos se borran.
 */
export { SITE_REGISTRY_MODULE, SITE_REGISTRY_TABLE } from './module-key';
export { resolveSite, listSites, siteIdOfChannel, toSiteRef } from './resolve-site';
export { attachSiteHint, siteFromRequest, siteHintOf, SITE_ID_HEADER, SITE_SLUG_HEADER, ALL_SITES, } from './request';
export { siteFromPublishableKey, siteIdFromPublishableKey, channelsFromPublishableKey, } from './publishable-key';
export { shouldFilter, UNKNOWN_SITE_ERROR_CODE } from './types';
export { siteFilter, siteChannelFilter, siteColumnFilter, siteDefaults, assertRowInSite, assertIdInSite, pickBySitePrecedence, type SiteInheritance, SITE_SCOPE_MAX_IDS, } from './scope';
export type { SiteScopeDescriptor, SiteColumnScope, NullMeans } from './scope';
export type { SiteRef, SiteHint, SiteResolution } from './types';
