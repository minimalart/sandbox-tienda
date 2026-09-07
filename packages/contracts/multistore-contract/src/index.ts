/**
 * Public contract for Mercatto multitenant plugins. Type-only, zero runtime
 * beyond canonical keys and headers.
 *
 * The host implementation lives in the boilerplate under
 * `apps/backend/src/lib/multistore/`. Plugins never import from there — they
 * resolve the host from the Medusa container via `MULTISTORE_HOST_KEYS` and
 * implement a local shim that adapts the host's shape to this contract.
 */

/**
 * Immutable reference to a tenant. `id` is the primary key of the site registry
 * (Mercatto uses `demo_...` prefixed ids); `slug` is the human-readable handle
 * used for URLs and cookies. `channel_ids` are the sales channels this site
 * owns — the plural is deliberate: a B2B site owns two.
 */
export type SiteRef = {
  id: string;
  slug: string;
  name: string;
  is_main: boolean;
  channel_ids: string[];
  region_id: string | null;
  stock_location_id: string | null;
};

/**
 * Hints the middleware attached to a request. All fields are best-effort — the
 * host decides how to combine them (site id + slug take precedence over channel
 * derivation).
 */
export type SiteHint = {
  siteId?: string | null;
  slug?: string | null;
  salesChannelId?: string | null;
  orderId?: string | null;
  cartId?: string | null;
  /**
   * When true, requests with no explicit site fall back to the main site.
   * Mercatto keeps this OFF for /admin/* and it is generally inappropriate for
   * /store/* — but exposed so hosts can opt in per surface.
   */
  allowMainFallback?: boolean;
};

/**
 * The outcome of resolving a request to a tenant. Consumers switch on `status`.
 *
 * - `site`             a specific tenant identified.
 * - `singleSite`       registry has exactly one tenant; no explicit hint given.
 * - `allSites`         request scoped to all tenants (admin viewing everything).
 * - `registryAbsent`   host has no multistore module; plugin operates in
 *                       single-tenant mode. The `reason` says why: module not
 *                       registered, table missing, or table empty.
 * - `unknownSite`      a specific tenant was asked for and doesn't exist. Do
 *                       NOT degrade — throwing is the right response, otherwise
 *                       a stale id leaks every other tenant's rows.
 */
export type SiteResolution =
  | { status: 'site'; site: SiteRef }
  | { status: 'singleSite'; site: SiteRef }
  | { status: 'allSites' }
  | { status: 'registryAbsent'; reason: 'module' | 'table' | 'empty' }
  | { status: 'unknownSite'; hint: SiteHint };

/**
 * Three semantics for NULL in a scoping column. NOT a boolean — mixing them
 * produces fail-open where fail-closed was intended.
 *
 * - `all`         plural data. NULL/[] means visible everywhere.
 * - `global`      config precedence. NULL is the fallback row, not one more
 *                 item in the list.
 * - `unassigned`  singular data. NULL means orphaned, visible to nobody.
 */
export type NullMeans = 'all' | 'global' | 'unassigned';

/**
 * How a table stores its tenant reference. `site_column` is the target of new
 * design (own `site_id` column); the others document existing legacy shapes.
 * A plugin authored today should prefer `site_column`.
 */
export type SiteScopeDescriptor =
  | { kind: 'site_column'; table: string; column: string; empty: NullMeans }
  | { kind: 'channel_array'; table: string; column: string; empty: NullMeans }
  | {
      kind: 'channel_array_json';
      table: string;
      column: string;
      path: string[];
      empty: NullMeans;
    }
  | { kind: 'channel_column'; table: string; column: string; empty: NullMeans }
  | {
      kind: 'join_table';
      table: string;
      joinTable: string;
      fk: string;
      column: string;
      empty: NullMeans;
    };

/**
 * Structural type any host must satisfy. Plugins do NOT import a concrete
 * implementation; they resolve the container by canonical key and type-assert
 * to this interface. Absence is a valid state (see `SiteResolution`).
 */
export interface MultistoreHost {
  siteFromRequest(req: unknown): Promise<SiteResolution>;
  resolveSite(hint: SiteHint): Promise<SiteResolution>;
  siteFilter(
    resolution: SiteResolution,
    descriptor: SiteScopeDescriptor
  ): Promise<Record<string, unknown>>;
}

/**
 * How the resolved value of a setting was reached. Consumers can log or gate
 * on this to distinguish "the site set this" from "fell back to global" from
 * "the site is off — no value".
 */
export type ResolutionOrigin = 'site' | 'global' | 'env' | 'default' | 'off';

export type ResolvedSetting<T> =
  | { status: 'configured'; value: T; origin: ResolutionOrigin }
  | { status: 'not_configured'; origin: 'off' | 'unset' };

/**
 * Optional peer capability. Plugins that need editable per-site config resolve
 * this from the container by key `app_settings`. Absence means the plugin
 * falls back to env vars only.
 */
export interface AppSettingsProvider {
  resolve<T>(args: {
    resolution: SiteResolution;
    namespace: string;
    key: string;
  }): Promise<ResolvedSetting<T>>;
}

export type ResolvedCredentials<T> =
  | { status: 'available'; value: T; origin: 'site' | 'global' | 'env' }
  | { status: 'unavailable'; origin: 'off' | 'unset' };

export interface SiteCredentialProvider {
  readSiteCredentials<T>(args: {
    integration: string;
    resolution: SiteResolution;
  }): Promise<ResolvedCredentials<T>>;
}

// ---------------------------------------------------------------------------
// Canonical container keys
// ---------------------------------------------------------------------------

/**
 * Order matters: `demo_store` is Mercatto's canonical literal (protected by
 * `modules/module-keys.test.ts` in the boilerplate). The camelCase and generic
 * fallbacks let other hosts adopt the contract without renaming.
 */
export const MULTISTORE_HOST_KEYS = [
  'demo_store',
  'demoStore',
  'site_registry',
  'siteRegistry',
] as const;

export const APP_SETTINGS_KEYS = ['app_settings', 'appSettings'] as const;

export const SITE_CREDENTIALS_KEYS = [
  'site_credentials',
  'siteCredentials',
] as const;

// ---------------------------------------------------------------------------
// Header names — canonical spellings from Mercatto for hint attachment
// ---------------------------------------------------------------------------

export const SITE_ID_HEADER = 'x-site-id';
export const SITE_SLUG_HEADER = 'x-site-slug';

/**
 * Explicit "all sites" value in the site id header. Distinct from the header
 * being absent, so hosts can distinguish "operator asked for all" from
 * "operator didn't pick" and later toggle a fail-closed policy without
 * breaking existing clients.
 */
export const ALL_SITES = '*';
