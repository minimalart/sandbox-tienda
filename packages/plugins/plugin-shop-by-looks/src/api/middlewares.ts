// Root middleware registry for the shop-by-looks plugin.
//
// Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
// Nested `admin/shop-by-looks/middlewares.ts` files are NOT scanned — they're a
// host-composer pattern that only works when the host explicitly imports and
// spreads them. This root file re-exports the plugin's own middleware routes so
// the Medusa loader picks them up.
//
// NOTE: no JSDoc block here. A JSDoc block that contains the literal string
// `*/` inside an SQL/comment snippet closes the doc block prematurely and
// produces confusing compile errors. Use `//` line comments in the plugin root
// middlewares to avoid that trap (v8 lesson from earlier plugin migrations).
import { defineMiddlewares } from '@medusajs/framework/http';
import { adminShopByLooksMiddlewares } from './admin/shop-by-looks/middlewares';

export default defineMiddlewares([...adminShopByLooksMiddlewares]);
