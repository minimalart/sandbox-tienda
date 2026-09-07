# Mercatto MCP tools test report

Date: 2026-07-04

Scope: full action validation of the connected Mercatto MCP on the Mercatto default context. For destructive actions, I created temporary fixtures first and then removed what was created whenever the backend exposed a safe cleanup route.

## Default Mercatto context

- Store: `store_01KT4M7NG3S6TV5XNBNTVB1A2V`
- Sales channel: `sc_01KT4M7NF6VY9A4NT4CR2FWA79`
- Region: `reg_01KVVFNSDSVGQ0MDNWRXHE0BBC`
- Stock location: `sloc_01KT4M7VNS465MZQF474PB7HYN`
- Tax region used for safe tax-rate tests: `txreg_01KT4M7VNDNGTEFS7HY4Q31VZ5`
- Fixture prefix: `Codex MCP ... 20260704-162413`

## Executive summary

- The connected MCP exposes 16 Mercatto tools; all 16 were exercised.
- The source package contains a product-options tool, but the connected MCP did not expose `manage_medusa_admin_product_options`.
- Most CRUD actions work once called with Medusa v2 payloads.
- Several tools were still using old Admin API routes or request shapes. I fixed these in `C:\Users\huevo\Documents\GitHub\mcp-medusa`.
- The MCP fixes were merged as `mcp-medusa@1.3.1` on commit `871357b6f9b120bab24b5d0197e1e1f0f16fbc65`.
- The boilerplate backend dependency was updated to `github:minimalart/mcp-medusa#871357b6f9b120bab24b5d0197e1e1f0f16fbc65`.
- Temporary products, variants, categories, collections, customers, addresses, groups, draft order, inventory item, stock location, reservation, campaign, promotion, price list, region, shipping profile, tax rate, invite, API key, and custom brand fixtures were cleaned up.
- One gift card fixture remains because this backend returns `404` for `DELETE /admin/gift-cards/{id}`. The fixture is marked safe to delete:
  - `gcard_01KWQ9TPFT5RAQ8FQ8T5M5XE5C`
  - code `CODEX-MCP-20260704-162413`
  - metadata `safe_to_delete: true`

## Cleanup evidence

- Product search for `Codex MCP` returned count `0`.
- Collection search for `Codex MCP` returned count `0`.
- Customer search for `Codex MCP` returned count `0`.
- Minimalart brand search for the fixture prefix returned count `0`.
- Reservation cleanup returned the tested inventory item reserved quantity to `0`.
- The invite and API key fixtures were deleted/revoked and deleted. No secret token is recorded in this report.

## Tool coverage

| Tool | Actions exercised | Result |
| --- | --- | --- |
| `manage_medusa_admin_products` | `list`, `get`, `create`, `update`, `delete`, `list_variants`, `get_variant`, `create_variant`, `update_variant`, `delete_variant`, `list_categories`, `get_category`, `create_category`, `update_category`, `delete_category`, `list_tags`, `list_types` | Passed after fixing product `status[]` filtering. |
| `manage_medusa_admin_sales_channels` | `list`, `get`, `create`, `update`, `delete`, `add_products`, `remove_products`, `list_products` | Add/remove/list product actions were broken; fixed to Medusa v2 shapes. |
| `manage_medusa_admin_collections` | `list`, `get`, `create`, `update`, `delete`, `add_products`, `remove_products`, `list_products` | Product association routes were broken; fixed by updating product `collection_id` and listing through `/admin/products`. |
| `manage_medusa_admin_customers` | `list`, `get`, `create`, `update`, `delete`, `create_address`, `list_addresses`, `get_address`, `update_address`, `delete_address`, `list_groups`, `get_group`, `create_group`, `update_group`, `delete_group`, `add_to_group`, `remove_from_group` | Group membership payloads were broken; fixed to `{ add: [...] }` / `{ remove: [...] }`. |
| `manage_medusa_admin_draft_orders` | `list`, `get`, `create`, `delete`, attempted `add_line_item` | Draft creation/deletion passed. `add_line_item` fails because `/admin/draft-orders/{id}/line-items` is not exposed. `convert_to_order` was not executed because it creates a persistent order without a cleanup tool path. |
| `manage_medusa_admin_orders` | `list`, `get`, `list_fulfillments` | Read actions passed. Destructive order actions were not executed against real orders because this MCP cannot create and then delete a full order fixture safely. |
| `manage_medusa_admin_pricing` | `list_price_lists`, `get_price_list`, `create_price_list`, `update_price_list`, `delete_price_list`, `list_promotions`, `get_promotion`, `create_promotion`, `update_promotion`, `delete_promotion`, `list_campaigns`, `get_campaign`, `create_campaign`, `update_campaign`, `delete_campaign` | Price-list `name` was broken; fixed by using `title` with `name` as an alias. Promotion and campaign CRUD passed. |
| `manage_medusa_admin_inventory` | `list_items`, `get_item`, `create_item`, `update_item`, `delete_item`, `list_locations`, `get_location`, `create_location`, `update_location`, `delete_location`, `list_levels`, `update_level`, `list_reservations`, `get_reservation`, `create_reservation`, `update_reservation`, `delete_reservation` | `list_levels` route was broken; fixed to `/admin/inventory-items/{id}/location-levels`. `update_level` needs an existing stocked item/location level; the temp item had no level. Reservation CRUD passed on an existing stocked item and was cleaned up. |
| `manage_medusa_admin_regions` | `list_regions`, `get_region`, `create_region`, `update_region`, `delete_region`, `list_shipping_options`, `get_shipping_option`, `create_shipping_option`, `list_shipping_profiles`, `get_shipping_profile`, `create_shipping_profile`, `update_shipping_profile`, `delete_shipping_profile`, `list_fulfillment_providers`, `list_fulfillment_sets`, attempted `create_fulfillment_set` | Shipping-option create payload was broken; fixed to require `service_zone_id`, `shipping_profile_id`, and `prices`. Fulfillment sets are not exposed by this backend, now returned as structured unsupported instead of raw 404. |
| `manage_medusa_admin_taxes` | `list_tax_regions`, `get_tax_region`, `create_tax_region`, `list_tax_rates`, `get_tax_rate`, `create_tax_rate`, `update_tax_rate`, `delete_tax_rate` | Tax-rate CRUD passed. Tax-region create required a provider; fixed schema and handler to pass `provider_id`. |
| `manage_medusa_admin_gift_cards` | `list`, `get`, `create`, `update`, attempted `delete` | Create/update field mapping was broken; fixed to use `code`, `value`, `currency_code`, `expires_at`, and metadata. Delete is not exposed by this backend and now returns structured unsupported. |
| `manage_medusa_admin_users` | `list_users`, `get_user`, `list_invites`, `create_invite`, `get_invite`, `resend_invite`, `delete_invite`, `list_api_keys`, `get_api_key`, `create_api_key`, `update_api_key`, `revoke_api_key`, `delete_api_key`, attempted `create_user` | Invite and API-key lifecycle passed. Direct user creation is not exposed by this backend and now returns structured unsupported. |
| `manage_medusa_admin_returns` | `list_returns`, `list_exchanges`, `list_claims`, `list_order_edits` | Empty read lists passed except order edits. Order-edit routes are not exposed by this backend and now return structured unsupported. Mutations were not executed because no disposable return/exchange/claim/order-edit fixture can be created safely. |
| `manage_medusa_admin_payments` | `list_payments`, `get_payment`, `list_payment_collections`, `get_payment_collection`, `list_refunds` | Payment read passed. Payment collections and refunds are not exposed by this backend and now return structured unsupported. Capture/cancel/refund were not executed because no disposable payment fixture can be created safely. |
| `manage_medusa_admin_v2` | `list stores`, `list currencies`, `list refund_reasons`, `list return_reasons`, raw requests for sales-channel/product association, price-list, inventory levels, gift cards, tax providers | Passed as a fallback tool and confirmed correct Medusa v2 routes/body shapes. |
| `manage_minimalart_extensions` | `list` for all exposed resources, `get brands`, `create/update/delete brands`, controlled create attempt on read-only `contact_submissions`, `commerce_dashboard` | Passed except `videos` ignores `limit: 1` and returns all videos. |

## Actions not executed on live business records

These actions are potentially destructive and the MCP does not provide a safe create/delete fixture path for them in Mercatto:

- Orders: `cancel`, `complete`, `archive`, `transfer`, `cancel_fulfillment`
- Draft orders: `convert_to_order`
- Payments: `capture_payment`, `cancel_payment`, `refund_payment`
- Returns: create/update/receive/cancel return, exchange, claim, and order-edit mutations
- Users: update/delete direct user flow, because direct `create_user` is not exposed

## Broken actions fixed in code

| Area | Original behavior | Implemented adjustment |
| --- | --- | --- |
| Products | `list` with `status: "draft"` failed because Medusa v2 expects `status[]`. | Normalize string or array into repeated `status[]` params. |
| Sales channels | Product add/remove/list used old or missing routes. | Use POST `{ add: [...] }`, POST `{ remove: [...] }`, and list via `/admin/products?sales_channel_id[]=...`. |
| Collections | Product add/remove/list used `/admin/collections/{id}/products`, which returns 404. | Associate by updating product `collection_id`; list via `/admin/products?collection_id[]=...`. |
| Customer groups | Membership used `customer_ids` and DELETE. | Use POST `{ add: [...] }` / `{ remove: [...] }`. |
| Price lists | Tool sent `name`; API requires `title`. | Use `title`, keeping `name` as a backward-compatible alias. |
| Inventory levels | Tool called `/admin/inventory-items/levels`. | Require `inventory_item_id` and call `/admin/inventory-items/{id}/location-levels`. |
| Shipping options | Tool sent old `region_id/profile_id/amount` shape. | Require `service_zone_id`, map profile to `shipping_profile_id`, and send `prices`. |
| Tax regions | Schema did not expose `provider_id`. | Add `provider_id` to schema and request body. |
| Gift cards | Tool sent old `type/balance/region_id` shape and delete threw raw 404. | Use `code/value/currency_code/expires_at`, support metadata updates, and return structured unsupported for delete. |
| Fulfillment sets | Backend returns 404. | Return structured unsupported instead of raw 404. |
| Payment collections/refunds | Backend returns 404. | Return structured unsupported instead of raw 404. |
| Order edits | Backend returns 404. | Return structured unsupported instead of raw 404. |
| Direct user create | Backend returns 404. | Return structured unsupported suggesting invites. |

## Files changed in `mcp-medusa`

- `lib/tool-schemas.ts`
- `tools/medusa-admin-api/medusa-admin-products.js`
- `tools/medusa-admin-api/medusa-admin-sales-channels.js`
- `tools/medusa-admin-api/medusa-admin-collections.js`
- `tools/medusa-admin-api/medusa-admin-customers.js`
- `tools/medusa-admin-api/medusa-admin-pricing.js`
- `tools/medusa-admin-api/medusa-admin-inventory.js`
- `tools/medusa-admin-api/medusa-admin-taxes.js`
- `tools/medusa-admin-api/medusa-admin-gift-cards.js`
- `tools/medusa-admin-api/medusa-admin-regions.js`
- `tools/medusa-admin-api/medusa-admin-payments.js`
- `tools/medusa-admin-api/medusa-admin-returns.js`
- `tools/medusa-admin-api/medusa-admin-users.js`

Build output in `dist/` was regenerated by `npm run build`.

## Verification

Executed in `C:\Users\huevo\Documents\GitHub\mcp-medusa`:

- `node --check` against every modified JavaScript handler: passed.
- `npm run build`: passed.
- `npm run test:unit`: passed, 18 tests passed.

Executed in `C:\Users\huevo\Documents\GitHub\medusa-b2c-boilerplate`:

- `corepack pnpm install --lockfile-only`: passed and updated the lockfile to the merged `mcp-medusa@1.3.1` commit.
- `corepack pnpm install --frozen-lockfile`: passed.
- `corepack pnpm --filter @repo/backend typecheck`: passed.

## Remaining work

1. Redeploy or reload the Mercatto MCP connector so the merged `mcp-medusa@1.3.1` package is the one serving tools.
2. Re-run the failing action subset through the connected MCP after deploy:
   - product `status` list filter
   - sales-channel add/remove/list products
   - collection add/remove/list products
   - customer group add/remove
   - price-list create/update
   - inventory `list_levels`
   - shipping-option create/update
   - tax-region create with `provider_id`
   - gift-card create/update/delete unsupported response
   - unsupported 404 wrappers for fulfillment sets, payment collections/refunds, order edits, and direct user create
3. Expose or refresh `manage_medusa_admin_product_options`; the source package has the tool, but the connected MCP did not show it.
4. Decide whether to add backend support or a cleanup/admin route for gift-card deletion, then delete `gcard_01KWQ9TPFT5RAQ8FQ8T5M5XE5C`.
5. Fix custom extension pagination for `videos`, which ignored `limit: 1`.
