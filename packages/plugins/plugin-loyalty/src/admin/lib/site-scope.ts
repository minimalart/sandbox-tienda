/**
 * Plugin-local screen-scope registry.
 *
 * The host has this file too, with the scope declaration of every admin screen
 * (~291 entries). The plugin only needs to declare its own screens; unknown
 * screens fall back to `'unscoped'` (which shows the honest "todavía no filtra"
 * label — same behavior as any migrating screen in the host).
 *
 * This is intentionally vendored (a copy) instead of imported from the host: the
 * plugin ships to any Mercatto instance and cannot depend on host admin lib
 * paths. Sibling plugins can vendor their own copy — the state that matters
 * (the active site id) lives in `localStorage['ms:active-site']` and is shared.
 */

export type SiteScopeState = 'scoped' | 'unscoped' | 'instance';

/**
 * Site-scope of each screen this plugin ships.
 *
 * `'scoped'` = every read AND every write on the screen carries `x-site-id`.
 * All 8 loyalty admin routes are scoped: the hook injects the header on every
 * request (see `admin/hooks/api/loyalty.tsx`), and the backend routes use
 * `siteFromRequest` + `siteFilter` + `assertIdInSite` (see `api/admin/loyalty/*`).
 */
const SCREEN_SITE_SCOPE: Record<string, SiteScopeState> = {
  'loyalty/dashboard': 'scoped',
  'loyalty/programs': 'scoped',
  'loyalty/rules': 'scoped',
  'loyalty/rewards': 'scoped',
  'loyalty/tiers': 'scoped',
  'loyalty/grants': 'scoped',
  'loyalty/campaigns': 'scoped',
  'loyalty/movimientos': 'scoped',
  // Configuration is a per-tenant screen too when a program is scoped by site.
  'loyalty/configuracion': 'scoped',
};

export const resolveScreenScope = (screen: string): SiteScopeState =>
  SCREEN_SITE_SCOPE[screen] ?? 'unscoped';
