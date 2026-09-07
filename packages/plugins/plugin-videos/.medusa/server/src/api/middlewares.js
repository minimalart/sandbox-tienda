"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Root middleware registry for the videos plugin.
 *
 * Medusa's plugin loader auto-discovers ONE file: `src/api/middlewares.ts`.
 * Nested `admin/videos/middlewares.ts` and `admin/vimeo/middlewares.ts` are NOT
 * scanned — they're a host-composer pattern that only works when the host
 * explicitly imports and spreads them.
 *
 * Post-migration to plugin, we need this file to expose the middlewares to the
 * plugin runtime. Without it `validateAndTransformQuery` / `validateAndTransformBody`
 * never run, so `req.validatedQuery` / `req.validatedBody` are undefined at the
 * route handlers (Vimeo OAuth callback, upload, videos CRUD, etc.).
 */
const medusa_1 = require("@medusajs/medusa");
const middlewares_1 = require("./admin/videos/middlewares");
const middlewares_2 = require("./admin/vimeo/middlewares");
exports.default = (0, medusa_1.defineMiddlewares)([
    ...middlewares_1.adminVideosMiddlewares,
    ...middlewares_2.adminVimeoMiddlewares,
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYXBpL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsNkNBQXFEO0FBQ3JELDREQUFvRTtBQUNwRSwyREFBa0U7QUFFbEUsa0JBQWUsSUFBQSwwQkFBaUIsRUFBQztJQUMvQixHQUFHLG9DQUFzQjtJQUN6QixHQUFHLG1DQUFxQjtDQUN6QixDQUFDLENBQUMifQ==