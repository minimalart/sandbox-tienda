// Root middleware registry for the payment-benefits plugin.
//
// Medusa's plugin loader auto-discovers ONE file: src/api/middlewares.ts.
// Nested admin middlewares files are NOT scanned — they're a host-composer
// pattern that only works when the host explicitly imports and spreads them
// (as apps/backend/src/api/extension-middlewares.ts used to do for the
// in-tree extension).
//
// The payment-benefits extension shipped ZERO middlewares — its manifest
// declares `integrations.middlewares: []`. Route handlers do their own
// Zod validation inline (see api/admin/payment-benefits/route.ts and
// [id]/route.ts), and multistore site resolution is done via helpers
// (siteFromRequest / siteFromPublishableKey) called directly from the
// handlers. Any future middleware for this plugin gets registered here.
import { defineMiddlewares } from '@medusajs/framework/http';

export default defineMiddlewares([]);
