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
import { defineMiddlewares } from '@medusajs/medusa';
import { adminCommentsMiddlewares } from './admin/comments/middlewares';
import { storeCommentsMiddlewares } from './store/comments/middlewares';

export default defineMiddlewares([
  ...adminCommentsMiddlewares,
  ...storeCommentsMiddlewares,
]);
