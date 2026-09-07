"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Root middleware registry for the catalogador plugin.
//
// Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
// Nested `admin/catalogador/middlewares.ts` files are NOT scanned — they're a
// host-composer pattern that only works when the host explicitly imports and
// spreads them. This root file re-exports the plugin's own middleware routes so
// the Medusa loader picks them up.
//
// NOTE: no JSDoc block here. A JSDoc block that contains the literal string
// `*/` inside an SQL/comment snippet closes the doc block prematurely and
// produces confusing compile errors. Use `//` line comments in the plugin root
// middlewares to avoid that trap (v8 lesson from earlier plugin migrations).
const http_1 = require("@medusajs/framework/http");
const middlewares_1 = require("./admin/catalogador/middlewares");
exports.default = (0, http_1.defineMiddlewares)([...middlewares_1.adminCatalogadorMiddlewares]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsdURBQXVEO0FBQ3ZELEVBQUU7QUFDRiw0RUFBNEU7QUFDNUUsOEVBQThFO0FBQzlFLDZFQUE2RTtBQUM3RSxnRkFBZ0Y7QUFDaEYsbUNBQW1DO0FBQ25DLEVBQUU7QUFDRiw0RUFBNEU7QUFDNUUsMEVBQTBFO0FBQzFFLCtFQUErRTtBQUMvRSw2RUFBNkU7QUFDN0UsbURBQTZEO0FBQzdELGlFQUE4RTtBQUU5RSxrQkFBZSxJQUFBLHdCQUFpQixFQUFDLENBQUMsR0FBRyx5Q0FBMkIsQ0FBQyxDQUFDLENBQUMifQ==