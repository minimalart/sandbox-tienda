// Root middleware registry for the checkout-links plugin.
//
// Medusa's plugin loader auto-discovers ONE file: src/api/middlewares.ts.
// Nested admin middlewares files are NOT scanned — they're a host-composer
// pattern that only works when the host explicitly imports and spreads them
// (as apps/backend/src/api/extension-middlewares.ts used to do for the
// in-tree extension).
//
// The checkout-links extension shipped ZERO middlewares — it uses Zod
// validation inline in the route handlers (api/admin/checkout-links/*.ts
// import PostAdmin* from ./validators and call .parse(req.body) directly).
// Any future middleware for this plugin gets registered here.
import { defineMiddlewares } from '@medusajs/framework/http';

export default defineMiddlewares([]);
