"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Root middleware registry for the gift-cards plugin.
//
// Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
// Nested `admin/gift-card-experience/middlewares.ts` files are NOT scanned — this root
// aggregates the plugin's own middleware routes so the Medusa loader picks them up.
//
// Missing this file caused THREE cascading bugs in production (v12 aprendizaje):
//   1. `validateAndTransformBody(GiftCardSettingsUpdate)` never ran on POST
//      /admin/gift-card-experience/settings → `req.validatedBody` undefined → 500.
//   2. `requireGiftCardAdminPermission(...)` never ran on ANY gift-card admin route
//      → any authenticated admin user could touch gift-card designs, deliveries,
//      settings, analytics — permission escalation vs the extension original intent.
//   3. Business `settings.enabled` was stuck at `false` (default) with no way to flip
//      it via admin, which blocked cart completion for gift cards → payments captured
//      by MercadoPago with no order created (PAGO COBRADO SIN ORDEN incident 2026-09-03).
//
// NOTE: no JSDoc block here. A JSDoc block containing the literal `*/` inside an
// embedded SQL/regex snippet closes the doc block prematurely (v8 lesson from earlier
// plugin migrations). Use `//` line comments to avoid that trap.
const http_1 = require("@medusajs/framework/http");
const middlewares_1 = require("./admin/gift-card-experience/middlewares");
exports.default = (0, http_1.defineMiddlewares)([...middlewares_1.adminGiftCardExperienceMiddlewares]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiw0RUFBNEU7QUFDNUUsdUZBQXVGO0FBQ3ZGLG9GQUFvRjtBQUNwRixFQUFFO0FBQ0YsaUZBQWlGO0FBQ2pGLDRFQUE0RTtBQUM1RSxtRkFBbUY7QUFDbkYsb0ZBQW9GO0FBQ3BGLGlGQUFpRjtBQUNqRixxRkFBcUY7QUFDckYsc0ZBQXNGO0FBQ3RGLHNGQUFzRjtBQUN0RiwwRkFBMEY7QUFDMUYsRUFBRTtBQUNGLGlGQUFpRjtBQUNqRixzRkFBc0Y7QUFDdEYsaUVBQWlFO0FBQ2pFLG1EQUE2RDtBQUM3RCwwRUFBOEY7QUFFOUYsa0JBQWUsSUFBQSx3QkFBaUIsRUFBQyxDQUFDLEdBQUcsZ0RBQWtDLENBQUMsQ0FBQyxDQUFDIn0=