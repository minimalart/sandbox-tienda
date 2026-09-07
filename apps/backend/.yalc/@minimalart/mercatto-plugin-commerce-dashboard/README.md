# @minimalart/mercatto-plugin-commerce-dashboard

Commerce analytics dashboard for Mercatto stores (Medusa 2.18+).

Ships:
- `commerce_dashboard` module with four daily-snapshot models: `commerce_metrics_daily`, `product_metrics_daily`, `collection_metrics_daily`, `customer_metrics_daily`
- Admin route `/app/commerce-dashboard` with KPIs, charts, breakdowns and top-N tables (recharts)
- Admin API: `GET /admin/commerce-dashboard`, `POST /admin/commerce-dashboard/aggregate`, `POST /admin/commerce-dashboard/seed-orders`
- Workflow `aggregate-commerce-metrics` that rebuilds snapshots from `order`/`order_item`/`order_summary`
- Seed scripts under `.medusa/server/src/scripts/` (dev-only)

Extracted from `apps/backend/src/modules/commerce-dashboard@1.2.2` and bumped to `1.3.0` to mark the plugin extraction (new distribution channel + no functional changes on read paths).

## Install

```
pnpm add @minimalart/mercatto-plugin-commerce-dashboard
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-commerce-dashboard', options: {} },
]
```

## Multi-tenant

Currently registered as `unscoped` in the host's `site-scope.ts`. The plugin reads `siteFromRequest` optionally to derive the active `sales_channel_id` when the caller does not pass one; when the host is single-tenant the resolver returns `null` and the dashboard shows all channels. No `SiteScopeBar` is vendored — the extension is not per-site scoped.
