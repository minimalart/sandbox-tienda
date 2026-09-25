/**
 * Seam multitienda — superficie pública.
 *
 * Vive en `src/lib/` y no en un módulo ni en un paquete de workspace:
 *  - un paquete `@repo/*` no sobrevive al deploy (DigitalOcean buildea `apps/backend`
 *    con el buildpack de npm, que no entiende `workspace:*`); por eso
 *    `packages/shared` está vendorizado en `src/lib/shared`;
 *  - `src/lib/` es lo único que `resolve-ownership.js` nunca auto-descubre, así que
 *    esta carpeta llega a todo proyecto de cliente elija las extensiones que elija.
 *    Lo verifica `packages/project-composer/src/index.test.js`.
 *
 * Ver `EXTENSIONES-MULTITIENDA.md` en el root.
 */
export { SITE_REGISTRY_MODULE, SITE_REGISTRY_TABLE } from './module-key';
export { resolveSite, listSites, listSiteBrands, siteIdOfChannel, toSiteRef, toSiteBrandColors } from './resolve-site';
export type { SiteBrandColors } from './resolve-site';
export { resolveSiteViaSql, SQL_MIRRORED_COLUMNS } from './resolve-site-sql';
export {
  attachSiteHint,
  siteFromRequest,
  siteHintOf,
  SITE_ID_HEADER,
  SITE_SLUG_HEADER,
  ALL_SITES,
} from './request';
export {
  siteFromPublishableKey,
  siteIdFromPublishableKey,
  channelsFromPublishableKey,
} from './publishable-key';
export { shouldFilter, UNKNOWN_SITE_ERROR_CODE } from './types';
export {
  siteFilter,
  siteChannelFilter,
  siteColumnFilter,
  siteDefaults,
  assertRowInSite,
  assertWritableSiteId,
  pickBySitePrecedence,
  type SiteInheritance,
  SITE_SCOPE_MAX_IDS,
} from './scope';
export type { SiteScopeDescriptor, SiteColumnScope, NullMeans } from './scope';
export { decideSiteIdWrite } from './site-write';
export type { SiteWriteVerdict, SiteWriteDenial, SiteIdWriteRequest } from './site-write';
export {
  encryptCredentials,
  decryptCredentials,
  readSiteCredentials,
  readSiteCredentialsViaSql,
  writeSiteCredentialsViaSql,
  deleteSiteCredentialsViaSql,
  listSiteCredentialsViaSql,
  countSiteCredentialsByIntegrationViaSql,
  mergeCredentialValues,
  sanitizeCredentialBag,
  SITE_CREDENTIAL_TABLE,
} from './credentials';
export type {
  SiteCredentialsResult,
  SiteCredentialSummary,
  SiteCredentialWrite,
  CredentialBag,
  CredentialWriteInput,
  CredentialMerge,
} from './credentials';
export { ADMIN_ROUTE_SCOPE } from './scoped-routes';
export type { RouteScopeState } from './scoped-routes';
export type { SiteRef, SiteHint, SiteResolution } from './types';
