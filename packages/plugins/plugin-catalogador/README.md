# @minimalart/mercatto-plugin-catalogador

Mass AI-assisted product catalog enrichment for Mercatto stores (Medusa 2.18+). Runs reviewable, resumable, recoverable enrichment executions over existing products: text field generation (title, subtitle, description, keywords, SEO), image standardization and lifestyle composition, plus optional external enrichment (barcode lookup and controlled web scraping via Tavily or an anti-SSRF-hardened HTTP fetcher). The AI proposes; the operator decides.

## Ships

- `catalogador` module with tables `cataloging_execution`, `cataloging_execution_product`, `cataloging_operation`, `cataloging_asset_proposal`, `cataloging_snapshot`, `cataloging_activity`.
- Admin routes under `/app/catalogador` (list, new, detail, config).
- Admin API under `/admin/catalogador/*` (config, executions CRUD + lifecycle: `generate`, `apply`, `cancel`, `duplicate`, `refloat`, `restore`; per-product review; per-asset review + editable-lifestyle composition; selection preview).
- Background job `catalogador-process` that drives execution generation and applying.
- Workflow `apply-execution` that persists accepted changes with snapshots and rollback support.
- Self-contained OpenRouter client (text + image) that does not couple to the Asistente IA or landing-page plugins (PRD §23.1).
- Multi-tenant scoping on `site_id` via the vendored `lib/multistore` shim (`empty: 'all'` on `cataloging_execution`, per the site-scope note).

## Environment

- `OPENROUTER_API_KEY` — OpenRouter credential for text and image generation.
- `OPENROUTER_SITE_URL` — HTTP-Referer attribution header.
- `CATALOGADOR_TEXT_MODEL` — text/vision multimodal model (default `google/gemini-2.5-flash`).
- `CATALOGADOR_IMAGE_MODEL` — image generation model (default `google/gemini-2.5-flash-image`).
- `CATALOGADOR_BARCODE_API_URL` — barcode provider endpoint with `{code}` placeholder. Empty = feature off.
- `CATALOGADOR_BARCODE_API_KEY` — optional bearer token for the barcode provider.
- `CATALOGADOR_TAVILY_API_KEY` — Tavily credential. Empty = `tavily` scraping is skipped with a warning.
- `CATALOGADOR_SCRAPE_SEARCH_TEMPLATE` — search template for the `http` scraping provider (with `{query}`/`{domain}` placeholders).
- `CATALOGADOR_JOB_SCHEDULE` — cron schedule for the background job driver.

## Install

```
pnpm add @minimalart/mercatto-plugin-catalogador
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-catalogador', options: {} },
]
```

The plugin persists its full config as a single `catalogador_config` setting via the host `storeConfig` module (`req.scope.resolve('storeConfig').readSetting`/`upsertSetting`). If the host does not register `storeConfig`, the config routes return 500 — same behaviour as the pre-migration extension. Image asset cleanup and upload go through the host `media_library` module when present, and fall back to the core `Modules.FILE` module otherwise.
