"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const http_1 = require("@medusajs/framework/http");
exports.default = (0, http_1.defineMiddlewares)([]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMERBQTBEO0FBQzFELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsMkVBQTJFO0FBQzNFLDRFQUE0RTtBQUM1RSx1RUFBdUU7QUFDdkUsc0JBQXNCO0FBQ3RCLEVBQUU7QUFDRixzRUFBc0U7QUFDdEUseUVBQXlFO0FBQ3pFLDJFQUEyRTtBQUMzRSw4REFBOEQ7QUFDOUQsbURBQTZEO0FBRTdELGtCQUFlLElBQUEsd0JBQWlCLEVBQUMsRUFBRSxDQUFDLENBQUMifQ==