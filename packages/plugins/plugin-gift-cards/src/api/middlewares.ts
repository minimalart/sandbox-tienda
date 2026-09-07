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
import { defineMiddlewares } from '@medusajs/framework/http';
import { adminGiftCardExperienceMiddlewares } from './admin/gift-card-experience/middlewares';

export default defineMiddlewares([...adminGiftCardExperienceMiddlewares]);
