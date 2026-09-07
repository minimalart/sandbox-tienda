"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Root middleware registry for the comments plugin.
 *
 * Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
 * Nested `admin/comments/middlewares.ts` / `store/comments/middlewares.ts` files
 * are NOT scanned — they're a host-composer pattern that only works when the
 * host explicitly imports and spreads them (as `apps/backend/src/api/extension-middlewares.ts`
 * used to do for the in-tree extension).
 *
 * Post-migration to plugin, we need this file to expose the same middlewares to
 * the plugin runtime. Without it `validateAndTransformQuery` / `validateAndTransformBody`
 * never run, so `req.validatedQuery` / `req.validatedBody` are undefined at the
 * route handler — first field access explodes with
 * `Cannot read properties of undefined (reading 'status')`.
 */
const medusa_1 = require("@medusajs/medusa");
const middlewares_1 = require("./admin/comments/middlewares");
const middlewares_2 = require("./store/comments/middlewares");
exports.default = (0, medusa_1.defineMiddlewares)([
    ...middlewares_1.adminCommentsMiddlewares,
    ...middlewares_2.storeCommentsMiddlewares,
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCw2Q0FBcUQ7QUFDckQsOERBQXdFO0FBQ3hFLDhEQUF3RTtBQUV4RSxrQkFBZSxJQUFBLDBCQUFpQixFQUFDO0lBQy9CLEdBQUcsc0NBQXdCO0lBQzNCLEdBQUcsc0NBQXdCO0NBQzVCLENBQUMsQ0FBQyJ9