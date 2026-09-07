# Changelog

## [1.1.0] - 2026-08-20

### Added

- Initial extraction from `apps/backend/src/modules/database-explorer@1.0.0`.
- Module `database_explorer` with five models (table/column/relation config, saved views, audit log).
- Admin route `/app/data` (label "Explorador de datos", `FolderOpen` icon).
- Admin API under `/admin/database-explorer/*` covering tables listing, row browsing, schema graph, saved views execution and audit log inspection.
- Access-control layer (allowlist + sensitive-column masking) preserved as-is.

### Rationale

Second tier-S migration of the plugin-conversion wave. Extension has zero consumers, no workflows/jobs, no external deps and no multi-tenant scoping (diagnostic tool by design). Moving it to a plugin frees the barrel in `admin/hooks/api/index.ts`, the entry in `medusa-config.ts` and the 12 `not-applicable` entries in `lib/multistore/scoped-routes.ts`.
