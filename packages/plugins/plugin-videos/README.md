# @minimalart/mercatto-plugin-videos

Mercatto plugin — Vimeo integration for shoppable videos.

## What it ships

- `vimeoVideo` Medusa module with three models: `vimeo_video`, `vimeo_token`,
  `product_video_link`.
- Admin API under `/admin/videos/*` and `/admin/vimeo/*` (OAuth start/callback,
  status, upload initiation, catalog search, CRUD, product linking, resync from
  Vimeo).
- Storefront-facing API at `/store/videos` — returns active videos scoped by
  `sales_channel_id` (empty channels = visible everywhere; `strict=1` for demo
  contexts to hide globals).
- Admin UI at `/app/videos` with a Vimeo OAuth connection card, the videos data
  table, upload/link drawers, and a per-site sales-channel multi-select.
- Admin translations (EN + ES) under the `videos` namespace.
- Multi-tenant filtering via `site_column` scope (vendored multistore helpers).

## What lives in the host

The shoppable-videos storefront viewer (`apps/storefront/src/modules/home/components/shoppable-videos/*`
and its `apps/storefront/src/lib/data/videos.ts` client) is intentionally kept
in the host storefront and is NOT shipped by this plugin. The plugin exposes
the backing `/store/videos` API; the host renders it.

## Install

```jsonc
// medusa-config.ts
{
  "plugins": [
    { "resolve": "@minimalart/mercatto-plugin-videos" }
  ]
}
```

## Configuration

The plugin reads its settings from `@minimalart/mercatto-plugin-runtime`
(`extension:videos` namespace) with a fallback to `process.env`. Same semantics
as the base extension had before the app-settings snapshot loaded.

### Environment variables

| Variable                        | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `VIMEO_CLIENT_ID`               | Vimeo OAuth app client id (required for the OAuth flow).   |
| `VIMEO_CLIENT_SECRET`           | Vimeo OAuth app client secret.                             |
| `VIMEO_ACCESS_TOKEN`            | Optional personal access token — bypasses the OAuth flow. |
| `VIMEO_FOLDER_URI`              | Optional Vimeo folder URI to scope uploads/search.         |
| `VIMEO_OAUTH_REDIRECT_SUCCESS`  | Where the OAuth callback lands the browser on success. Defaults to `/app/videos`. |

## Notes

- Multi-tenant: videos carry a `sales_channel_ids` jsonb array. Empty/null =
  visible in all stores; a populated array scopes visibility to those stores.
- Peer deps: this plugin requires both `@minimalart/mercatto-multistore-contract`
  and `@minimalart/mercatto-plugin-runtime`.
