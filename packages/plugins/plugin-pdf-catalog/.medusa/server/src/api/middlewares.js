"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Root middleware registry for the pdf-catalog plugin.
 *
 * Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
 * Nested `admin/pdf-catalogs/middlewares.ts` is NOT scanned — it's a host-composer
 * pattern that only works when the host explicitly imports and spreads it.
 *
 * Post-migration to plugin, we need this file to expose the middleware to the
 * plugin runtime. Without it `validateAndTransformBody` never runs, so
 * `req.validatedBody` is undefined at the route handler.
 */
const medusa_1 = require("@medusajs/medusa");
const middlewares_1 = require("./admin/pdf-catalogs/middlewares");
exports.default = (0, medusa_1.defineMiddlewares)([...middlewares_1.adminPdfCatalogsMiddlewares]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7R0FVRztBQUNILDZDQUFxRDtBQUNyRCxrRUFBK0U7QUFFL0Usa0JBQWUsSUFBQSwwQkFBaUIsRUFBQyxDQUFDLEdBQUcseUNBQTJCLENBQUMsQ0FBQyxDQUFDIn0=