# @minimalart/mercatto-plugin-landing-pages

Visual-built marketing landings for Mercatto stores (Medusa 2.18+). Pages are authored with the Puck editor (JSON, no raw HTML), so rendering stays under our component mapping, and they support AI-assisted content generation (structure, copy, SEO, translation and hero/image generation) via OpenRouter.

## Ships

- `landing-page` module with the `landing_page` table (id, title, slug, status, seo, puck_data, template, locale, sales_channel_id, metadata).
- Admin routes under `/app/landing-pages` (list + editor).
- Admin API: `GET/POST /admin/landing-pages`, `GET/POST/DELETE /admin/landing-pages/:id`, `/admin/landing-pages/:id/{publish,unpublish,duplicate,ai-generate,ai-improve-copy,ai-seo,ai-translate,ai-image}`.
- Store API: `GET /store/landing-pages` (paginated), `GET /store/landing-pages/:slug` (detail).
- Multi-tenant scoping via `channel_column` on `sales_channel_id` (empty = visible to all stores), using the vendored `lib/multistore` shim.

## Environment

- `OPENROUTER_API_KEY` — OpenRouter credential for text + image generation.
- `OPENROUTER_MODEL` — text model (default `openai/gpt-4.1-mini`).
- `OPENROUTER_SITE_URL` — HTTP-Referer attribution header.
- `LANDING_AI_MAX_RETRIES` — retries when the model returns invalid JSON (default 2, max 5).

## Install

```
pnpm add @minimalart/mercatto-plugin-landing-pages
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-landing-pages', options: {} },
]
```

The plugin's AI routes read model overrides from the host `storeConfig` module (`req.scope.resolve('storeConfig').getAiConfig()`). If the host does not register `storeConfig`, the AI routes return 500 — the same behaviour as the pre-migration extension.
