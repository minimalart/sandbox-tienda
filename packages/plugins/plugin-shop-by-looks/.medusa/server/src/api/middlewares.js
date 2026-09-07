"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const http_1 = require("@medusajs/framework/http");
const middlewares_1 = require("./admin/shop-by-looks/middlewares");
exports.default = (0, http_1.defineMiddlewares)([...middlewares_1.adminShopByLooksMiddlewares]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseURBQXlEO0FBQ3pELEVBQUU7QUFDRiw0RUFBNEU7QUFDNUUsZ0ZBQWdGO0FBQ2hGLDZFQUE2RTtBQUM3RSxnRkFBZ0Y7QUFDaEYsbUNBQW1DO0FBQ25DLEVBQUU7QUFDRiw0RUFBNEU7QUFDNUUsMEVBQTBFO0FBQzFFLCtFQUErRTtBQUMvRSw2RUFBNkU7QUFDN0UsbURBQTZEO0FBQzdELG1FQUFnRjtBQUVoRixrQkFBZSxJQUFBLHdCQUFpQixFQUFDLENBQUMsR0FBRyx5Q0FBMkIsQ0FBQyxDQUFDLENBQUMifQ==