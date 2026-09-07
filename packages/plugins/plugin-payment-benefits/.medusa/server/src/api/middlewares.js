"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const http_1 = require("@medusajs/framework/http");
exports.default = (0, http_1.defineMiddlewares)([]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNERBQTREO0FBQzVELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsMkVBQTJFO0FBQzNFLDRFQUE0RTtBQUM1RSx1RUFBdUU7QUFDdkUsc0JBQXNCO0FBQ3RCLEVBQUU7QUFDRix5RUFBeUU7QUFDekUsdUVBQXVFO0FBQ3ZFLHFFQUFxRTtBQUNyRSxxRUFBcUU7QUFDckUsc0VBQXNFO0FBQ3RFLHdFQUF3RTtBQUN4RSxtREFBNkQ7QUFFN0Qsa0JBQWUsSUFBQSx3QkFBaUIsRUFBQyxFQUFFLENBQUMsQ0FBQyJ9