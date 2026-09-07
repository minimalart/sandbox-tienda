# @minimalart/mercatto-plugin-database-explorer

Read-only admin database explorer for Mercatto stores (Medusa 2.18+).

Ships:
- `database_explorer` module with 5 config/audit models: `database_explorer_table_config`, `database_explorer_column_config`, `database_explorer_relation_config`, `database_explorer_saved_view`, `database_explorer_audit_log`
- Admin route `/app/data` (sidebar label: "Explorador de datos")
- Admin API under `/admin/database-explorer/*` (tables, rows, relations, schema-graph, saved views, audit log, settings)
- Backend allowlist + sensitive-column masking at the service layer; audit log on every read

Extracted from `apps/backend/src/modules/database-explorer@1.0.0` and bumped to `1.1.0` to mark the plugin extraction (new distribution channel + no functional changes).

## Install

```
pnpm add @minimalart/mercatto-plugin-database-explorer
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-database-explorer', options: {} },
]
```

## Multi-tenant

Diagnostic tool that navigates the entire DB by design (core Medusa tables have no store axis). All admin routes are declared `not-applicable` in the host's scoped-routes registry.
