# @minimalart/mercatto-plugin-pdf-catalog

Mercatto plugin that ships **navigable PDF catalogs per sales channel** with **clickable hotspots** (product, video, text) rendered on top of each page.

## What it does

- Admin uploads a PDF and drops hotspots on the pages: **product** (adds to cart), **video** (YouTube), **text**.
- Storefront serves the **active** catalog for the current sales channel (one active per channel).
- Product hotspots are enriched in real time with price (by region) and stock — nothing is snapshotted.

## Model

- `pdf_catalog` — the catalog itself (name, PDF url/file, pages, published).
- `pdf_catalog_hotspot` — one row per hotspot on a specific page (0-based).
- `pdf_catalog_channel` — join table `sales_channel_id → catalog_id` with a partial UNIQUE index that enforces "one active catalog per channel". Activating a channel already used by another catalog steals it.

## Backend surface

- Store API `GET /store/pdf-catalog/active?sales_channel_id=...&region_id=...` — returns the enriched active catalog or `{ catalog: null }`.
- Admin API `/admin/pdf-catalogs` — CRUD + `file?id=<file_id>` proxy that streams the PDF same-origin (the S3 bucket has no CORS, so `react-pdf` can't fetch it directly).
- Admin UI at `/pdf-catalogs` — list, create/edit drawer, hotspot placement over the PDF.
- Workflow `create-pdf-catalog` — atomic create with hotspots + channel reconcile.

## Soft dependencies

The store API route reads `pdf_catalog_enabled` from the host `store-config` module when present. If the module is not installed, the feature stays **off** (returns `{ catalog: null }`), matching the extension's behavior when the flag is falsy.
