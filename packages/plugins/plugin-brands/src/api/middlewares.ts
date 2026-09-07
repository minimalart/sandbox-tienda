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
import { defineMiddlewares } from '@medusajs/framework/http';
import { adminBrandsMiddlewares } from './admin/brands/middlewares';

export default defineMiddlewares([...adminBrandsMiddlewares]);
