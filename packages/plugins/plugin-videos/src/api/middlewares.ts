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
import { defineMiddlewares } from '@medusajs/medusa';
import { adminVideosMiddlewares } from './admin/videos/middlewares';
import { adminVimeoMiddlewares } from './admin/vimeo/middlewares';

export default defineMiddlewares([
  ...adminVideosMiddlewares,
  ...adminVimeoMiddlewares,
]);
