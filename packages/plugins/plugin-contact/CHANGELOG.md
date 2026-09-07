# Changelog

All notable changes to this plugin are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/) and semver.

## [1.4.0] - 2026-08-19

### Added — SiteScopeBar vendored (paridad multi-tenant con plugin-loyalty v1.1.0)

- Vendored `SiteScopeBar` component (549 LOC total in 5 files):
  - `admin/lib/active-site.ts` (211 LOC): `useSyncExternalStore` singleton that persists `{ id, slug, name }` to `localStorage['ms:active-site']` and notifies subscribers on tenant switch. Copy of the host file; both read/write the same slot so they stay in sync.
  - `admin/lib/http.ts` (48 LOC): `fetchJson` helper that pipes `siteHeader()` into every admin request from vendored components (SiteScopeBar's manifest query uses it).
  - `admin/lib/site-scope.ts` (39 LOC): mini per-screen scope registry. Only screen: `contact-submissions` → `'scoped'`.
  - `admin/hooks/use-active-site.ts` (78 LOC): React hook wrapping the store with `/admin/multistore/manifest` query.
  - `admin/components/common/site-scope-bar.tsx` (173 LOC): the visual bar with the tenant selector, scope badge and stale-selection warning.
- Rendered `<SiteScopeBar screen="contact-submissions" />` right after the flex header in the admin page.

### Rationale

The `x-site-id` header injection was already in the hooks (since 1.1.0), so the backend has been filtering correctly per tenant for a while. This bump adds the **visual** selector inside the plugin's admin page so the operator can switch tenant without leaving the Contacto view — matches the pattern shipped in `plugin-loyalty` v1.1.0.

Duplication is intentional. The host's `SiteScopeBar` has 61 call sites across 28 extensions and cannot be extracted to a shared package without a coordinated PR across every consumer. Each plugin vendors its own copy; sibling plugins stay in sync because the active tenant lives in the shared `localStorage['ms:active-site']` slot. When `@minimalart/mercatto-multistore-ui` exists, this copy migrates to a re-export in a follow-up bump.

### Auto-hide semantics

`SiteScopeBar` renders null when the host reports 0 or 1 registered store (via `/admin/multistore/manifest`), so single-tenant hosts get zero-noise from this bump.

## [1.3.0] - 2026-08-13

### Changed

- Admin badge no longer hardcodes the plugin version. `page.tsx` now imports `package.json` at build time and Vite inlines the value, so future bumps update the badge automatically without a source edit.

## [1.2.0] - 2026-08-13

### Added

- `exports./admin` in `package.json` so the host's `medusa build` discovers the plugin admin extensions and includes them in the dashboard bundle. Before this, the sidebar entry "Contacto" did not render even though the server routes worked.
- `exports./.medusa/server/src/modules/*` and `./providers/*` wildcards so Medusa's module loader can require the plugin's modules under their canonical paths.

### Fixed

- `siteFilter` in `multistore-shim.ts` now throws `MedusaError(NOT_FOUND)` instead of a plain `Error` when the tenant is `unknownSite`. The plain `Error` bubbled up as an opaque HTTP 500 whenever `localStorage['ms:active-site']` pointed at a stale or removed demo id, breaking the plugin's list page. Aligns with the host's `assertIdInSite` semantics (404, no leak of tenant existence).

## [1.1.0] - 2026-08-13

### Added

- `assertIdInSite` in `multistore-shim.ts` — guard that raw-SQL checks the tenant ownership of an id before mutations, so scoped views cannot be side-stepped by knowing the id. Honors `descriptor.empty` (`'all'` / `'global'` include NULL rows; `'unassigned'` fails closed).
- Admin `[id]` route (POST + DELETE) now calls `assertIdInSite` before mutating, mirroring the host-side extension after commit `040541dd`.
- Admin hooks now send `x-site-id` header on every request. The active tenant id is read from `localStorage['ms:active-site']` — the same slot the host writes on tenant switch — so the plugin stays in sync without importing host admin code.

### Notes

- The visual `SiteScopeBar` banner added by the host (commit `fac15423`) is not shipped with the plugin. The multi-tenant filtering itself remains fully functional; users just lose the "you are viewing store X" banner unless the host renders one above the plugin's page.

## [1.0.0] - 2026-08-12

### Added

- Initial extraction from `packages/extensions/contact@1.2.0`
- Module `contact` with `contact_submission` model
- Admin routes `/admin/contact-submissions`
- Storefront route `/store/contact-submissions`
- Admin UI page for submission review
- Migrations `Migration20260613200000` and `Migration20260807140000Contact`
