# @minimalart/mercatto-plugin-banners

Home placement banners for Mercatto stores (Medusa 2.18+). Merchants manage banner areas of the storefront — one card per placement (hero, promo, etc.) — with copy + image generation via AI (OpenRouter), publishing, scheduling, per-sales-channel scoping and per-banner rule targeting (customer groups, locale, country, device, path).

## Ships

- `banner` module with three tables: `banner`, `banner_analytics`, `banner_audit`.
- Admin routes under `/app/banners` (overview + per-placement editor with drawer).
- Admin API:
  - `GET/POST /admin/banners`, `GET/POST/DELETE /admin/banners/:id`
  - `POST /admin/banners/:id/{publish,unpublish,archive}`
  - `POST /admin/banners/ai-generate` — AI copy
  - `POST /admin/banners/ai-image` — AI image (nano banana via OpenRouter, WebP-optimized, uploaded to the File module)
  - `POST /admin/banners/ai-compose` — copy + image in one call, with optional product reference imagery
- Store API:
  - `GET /store/banners?placement=…` — resolves published, active (date window) and rule-matched banners
  - `POST /store/banners/:id/{click,impression}` — analytics counters
- Multi-tenant scoping via `channel_array_json` on `rules.sales_channel_ids` (empty = visible to all stores), using the vendored `src/lib/multistore` shim.

## Environment

- `OPENROUTER_API_KEY` — OpenRouter credential for text + image generation.
- `OPENROUTER_MODEL` — text model (default `openai/gpt-4.1-mini`).
- `OPENROUTER_SITE_URL` — HTTP-Referer attribution header.
- `LANDING_AI_MAX_RETRIES` — retries when the model returns invalid JSON (default 2).

## Install

```
pnpm add @minimalart/mercatto-plugin-banners
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-banners', options: {} },
]
```

The plugin's AI routes read model overrides from the host `storeConfig` module (`req.scope.resolve('storeConfig').getAiConfig()`). If the host does not register `storeConfig`, the AI routes return 500 — the same behaviour as the pre-migration extension.
