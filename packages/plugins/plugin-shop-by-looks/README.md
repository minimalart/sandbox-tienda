# @minimalart/mercatto-plugin-shop-by-looks

Shoppable editorial looks for Mercatto stores (Medusa 2.18+). Ships an editorial "look" (title, subtitle, cover image, CTA) with product hotspots placed by X/Y percent on the image, plus a segmented public endpoint that enriches products with region-scoped prices and stock, and hides looks that would render empty.

## Ships

- `shop_by_look` module with tables `shop_by_look` and `shop_by_look_product`.
- Admin route under `/app/shop-by-looks` (list + FocusModal-based create/edit with hotspot placement).
- Admin API under `/admin/shop-by-looks` (list/create + `[look_id]` GET/POST/DELETE).
- Public API `GET /store/shop-by-look` — per-store toggle honoured (via `storeConfig.readSetting` + publishable key resolution), segmented by sales channel / region, products enriched by the core Query with `calculated_price` context and stock aggregation from inventory levels.
- Workflow `create-shop-by-look` (intra-plugin) invoked from the admin POST route.
- Multi-tenant scoping on `sales_channel_ids` (channel array descriptor, `empty: 'all'`) via the vendored `lib/multistore` shim.

## Install

```
pnpm add @minimalart/mercatto-plugin-shop-by-looks
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-shop-by-looks', options: {} },
]
```

## Host dependencies

The plugin reads the master toggle (`shop_by_look_enabled`) from the host `storeConfig` module via `req.scope.resolve('storeConfig').readSetting(...)`. If the host does not register `storeConfig`, the store endpoint fails closed (500) — same behaviour as the pre-migration extension and coherent with the `storeConfig` dependency declared in `mercatto-plugin.json`. Image upload and media selection in the admin drawer use the core `admin.upload.create` / `admin.product.list` SDK endpoints; `media_library` is declared as a soft dependency so the host media picker can be reused when present.

## Storefront

The storefront-side rendering of a Shop by Look block (image + hotspots + product cards) stays in the storefront app (`apps/storefront/src/modules/home/components/shop-by-look`) and only consumes the public `GET /store/shop-by-look` endpoint exposed by this plugin.
