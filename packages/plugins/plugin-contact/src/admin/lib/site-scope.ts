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
 *
 * Kept in lock-step with `plugin-loyalty/.../site-scope.ts` — same 39-LOC
 * shape, only the screen list differs.
 */

export type SiteScopeState = 'scoped' | 'unscoped' | 'instance';

/**
 * Site-scope of each screen this plugin ships.
 *
 * `'scoped'` = every read AND every write on the screen carries `x-site-id`.
 * The single contact-submissions admin route is scoped: the hook injects the
 * header on every request (see `admin/hooks/api/contact-submissions.tsx`), and
 * the backend routes use `siteFromRequest` + `siteFilter` + `assertIdInSite`
 * (see `api/admin/contact-submissions/route.ts`).
 */
const SCREEN_SITE_SCOPE: Record<string, SiteScopeState> = {
  'contact-submissions': 'scoped',
};

export const resolveScreenScope = (screen: string): SiteScopeState =>
  SCREEN_SITE_SCOPE[screen] ?? 'unscoped';
