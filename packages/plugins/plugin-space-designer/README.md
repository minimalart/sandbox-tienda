# Space Designer

Optional Medusa 2 plugin for backoffice-authored space configurators. A published template already contains its furniture at saved coordinates and any included equipment, such as computers, projectors or robotics kits. The same engine supports classrooms, offices, workshops and showrooms.

## Contract

`src/types.ts` is the v1 contract. A configurator has a unique `slug`, `title`, `status`, optional `sales_channel_id` and a versioned `config`. Drafts can be empty. Publication requires at least one template and every template must already have furniture on its plan.

Catalog entries reference actual Medusa `product_id` and `variant_id`. Scene entries also have physical dimensions and an image, parametric or GLB asset. Included equipment can define the same 3D representation, mount and a scene product anchor; visual distribution never adds billable quantities. Templates contain `room`, placed `objects` and `included_items` with quantities. Coordinates and dimensions are metres; `x` and `z` are the centre of the item footprint. Rotation is degrees, defaulting to the allowed set 0/90/180/270; scale defaults to 1. Assets accept http(s) URLs or absolute paths and are not fetched by this backend.

Asset `model` selects table, desk, hex-table-set, shelving, cabinet, chair, computer, projector or robotics-kit geometry. `color` and `accent_color` configure materials. `mount` supports floor, surface, wall or ceiling; optional `anchor_product_ref` must resolve to another scene product in this configurator. External GLB assets are loaded by the storefront and fitted to the product dimensions. Room `floor_texture_url`/`wall_texture_url` and surface-option `texture_url` preserve configurable finishes. The admin edits these fields alongside the existing plan editor. Texture and GLB hosts must allow browser access, including CORS when hosted separately.

`allow_custom: false` restricts purchases to an exact saved template. Otherwise furniture and equipment quantities can be adjusted, while `locked` template furniture retains its position. Scene bounds, variant bindings, allowed rotations, finite quantities and duplicate references are validated on the server. Configurator edits replace the JSON atomically.

## APIs

- `GET/POST /admin/space-designer/configurators`: paginated list and create.
- `GET/POST/DELETE /admin/space-designer/configurators/:id`: retrieve, partial update and archive.
- `GET /admin/space-designer/products`: actual catalog and variants, with `q`, `limit`, `offset`, `sales_channel_id`.
- `GET /admin/space-designer/designs`: customer designs for the selected site.
- `GET /store/space-designer/configurators`: published configurators authorized by the publishable key.
- `GET /store/space-designer/configurators/:slug`: `{ configurator }` with live `catalog`; optional `region_id` or `cart_id` supplies native price context.
- `POST /store/space-designer/line-items`: `{ cart_id, configurator_id, template_id?, snapshot }`, adds all quantities with one native `addToCartWorkflow` and returns `{ added: true, items_count }`.
- `GET/POST /store/space-designer/designs` and `GET /store/space-designer/designs/:id`: authenticated customer persistence. A design stores the configuration snapshot and flags `stale` on retrieval if the published configuration changed. No historical price is used for purchases.

Lists return the named array plus `count`, `offset` and `limit`. Admin scope uses the active `x-site-id` when provided; an unscoped admin can manage global configurators. Store scope comes exclusively from the publishable key's sales channels. Store query parameters cannot expand it. Catalog validation checks product/variant ownership and channel membership. A global configurator still exposes only products allowed by the request's channel. Customer-specific prices and designs use `private, no-store` responses.

Cart writes validate the cart's channel, completion and customer ownership, then validate each selected variant's publication, channel, stock signal and current price. Native Medusa performs the final price, promotion, inventory and quantity checks. The client never sets `unit_price`. Orders retain ordinary Medusa line items and compact configurator provenance in `metadata.space_designer`.

## Installation and verification

Install or locally link this package, then register it in Medusa's `plugins` configuration. It auto-registers the `space_designer` module. Run the normal Medusa migration process to create `space_configurator` and `space_design`; no fixture or catalog is seeded automatically. The host may disable installation with `SPACE_DESIGNER_ENABLED=false`. Only published configurators appear in the storefront.

This package is initially local/experimental until its first registry release; do not add a dependency on a nonexistent published version. It depends only on Medusa, React admin packages, Zod and the shared Mercatto runtime contract, with no dependency on another feature plugin.

From the plugin folder, run `pnpm build`. In this monorepo, run the focused backend tests from `apps/backend`:

```powershell
node --experimental-transform-types --import ./test-register.mjs --test ../../packages/plugins/plugin-space-designer/src/validation.test.ts ../../packages/plugins/plugin-space-designer/src/api/shared.test.ts
```

The plugin neither creates products nor invents prices. Choose existing catalog products in the backoffice before publishing a template. The `examples` folder illustrates a client configuration and must be bound to the actual store's products before use.
