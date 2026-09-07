# Changelog

All notable changes to this plugin are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/) and semver.

## [1.3.0] - 2026-08-20

### Added

- Initial extraction from `apps/backend/src/modules/commerce-dashboard@1.2.2`.
- Module `commerce_dashboard` with four daily-snapshot models.
- Admin routes: `/admin/commerce-dashboard` (GET dashboard), `/aggregate` (POST rebuild), `/seed-orders` (POST dev seed).
- Admin UI page with KPIs, charts (recharts), breakdowns and top-N tables.
- Workflow `aggregate-commerce-metrics` (raw SQL against `order`/`order_item`/`order_summary`).
- Multi-tenant: kept as `unscoped` (no `SiteScopeBar` vendored). Active `sales_channel_id` is inferred from the host's `demo_store` module when present, using a shim that degrades to no-op when the module is not registered.

### Rationale

The extension had zero storefront footprint and only a soft consumer (`ai-assistant`'s `analytics-tools.ts` resolves it via container with a graceful fallback). Moving it to a plugin frees up the barrel in `admin/hooks/api/index.ts` and the entry in `medusa-config.ts`, and lets the version travel independently through the pivot version-checker.
