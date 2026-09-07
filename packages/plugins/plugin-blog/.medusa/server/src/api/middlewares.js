"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Root middleware registry for the blog plugin.
 *
 * Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
 * Nested `admin/<resource>/middlewares.ts` files are NOT scanned — they're a
 * host-composer pattern that only works when the host explicitly imports and
 * spreads them.
 *
 * The blog routes do NOT use `validateAndTransformBody`; each handler parses the
 * body inline via zod, so there is nothing to register here today. The file
 * exists to make the plugin's middleware surface explicit and to give future
 * work a single obvious place to plug in without touching every route.
 */
const http_1 = require("@medusajs/framework/http");
exports.default = (0, http_1.defineMiddlewares)([]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsbURBQTZEO0FBRTdELGtCQUFlLElBQUEsd0JBQWlCLEVBQUMsRUFBRSxDQUFDLENBQUMifQ==