# Changelog

All notable changes to this plugin are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/) and semver.

## [1.1.0] - 2026-08-19

### Added — Full multi-tenant admin parity

- `admin/hooks/api/loyalty.tsx` now injects `x-site-id` header on every request. The active tenant id is read from `localStorage['ms:active-site']` — the same slot the host writes on tenant switch — so the plugin stays in sync without importing host admin code. Mirrors the same pattern shipped in `plugin-contact` v1.1.0.
- Vendored `SiteScopeBar` component inside the plugin (549 LOC total: `active-site.ts` store, `use-active-site.ts` hook, `site-scope.ts` per-screen scope registry, `http.ts` fetch helper, `site-scope-bar.tsx` component). Added to all 8 admin routes:
  - `loyalty/dashboard`, `loyalty/campaigns` (campanas), `loyalty/grants` (canjes), `loyalty/configuracion`, `loyalty/movimientos`, `loyalty/tiers` (niveles), `loyalty/rewards` (recompensas), `loyalty/rules` (reglas).
  - All screens declared `'scoped'` — every read and every write carries `x-site-id`.
- The `SiteScopeBar` reads the tenant list from `/admin/multistore/manifest` (host core endpoint, always present). If the host has zero or one store registered, the bar auto-hides — same behavior as the host copy.
- Duplication is intentional: the SiteScopeBar in the host has 61 call sites and cannot be extracted to a shared package without a coordinated PR across every extension. The plugin ships its own copy so sibling plugins can adopt the same pattern independently. When a `@minimalart/mercatto-multistore-ui` package exists, this copy migrates to a re-export.

### Notes

- No breaking changes vs 1.0.0. Templates that already registered `plugin-loyalty` keep working; the only new behavior is that the admin now respects the active tenant instead of showing all stores mixed.

## [1.0.0] - 2026-08-14

### Added

- Initial extraction from `packages/extensions/loyalty-points@1.4.0` and `packages/extensions/loyalty-engine@1.8.0`, bundled into a single plugin.
- Module `points` with `points_account`, `points_transaction` models and ledger service.
- Module `loyalty` with `loyalty_program`, `loyalty_tier`, `loyalty_reward`, `loyalty_reward_grant`, `loyalty_earn_rule`, `loyalty_campaign` models and engine service.
- Admin routes `/app/loyalty` and 8 sub-routes; customer-loyalty widget.
- Admin API `/admin/loyalty/*` (campaigns, customers, dashboard, grants, movements, programs, rewards, rules, tiers).
- Storefront API `/store/points/*` and `/store/loyalty/*`.
- Workflows: earn, redeem-reward, reverse.
- Subscribers: order-placed, order-canceled, customer-created, comment-approved.
- Job: expire-loyalty-points.
- Multi-tenant scoping via `@minimalart/mercatto-multistore-contract` (opt-in by presence).
