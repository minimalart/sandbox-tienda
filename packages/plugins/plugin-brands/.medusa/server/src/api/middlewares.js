"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Root middleware registry for the brands plugin.
 *
 * Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
 * Nested `admin/brands/middlewares.ts` files are NOT scanned — they're a
 * host-composer pattern that only works when the host explicitly imports and
 * spreads them (as `apps/backend/src/api/extension-middlewares.ts` used to do
 * for the in-tree extension).
 *
 * Post-migration to plugin, we need this file to expose the same middlewares to
 * the plugin runtime. Without it `validateAndTransformBody` never runs, so
 * `req.validatedBody` is undefined at the route handler — first field access
 * explodes with `Cannot read properties of undefined`.
 */
const http_1 = require("@medusajs/framework/http");
const middlewares_1 = require("./admin/brands/middlewares");
exports.default = (0, http_1.defineMiddlewares)([...middlewares_1.adminBrandsMiddlewares]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILG1EQUE2RDtBQUM3RCw0REFBb0U7QUFFcEUsa0JBQWUsSUFBQSx3QkFBaUIsRUFBQyxDQUFDLEdBQUcsb0NBQXNCLENBQUMsQ0FBQyxDQUFDIn0=