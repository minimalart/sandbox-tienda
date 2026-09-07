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
import { defineMiddlewares } from '@medusajs/medusa';
import { adminPdfCatalogsMiddlewares } from './admin/pdf-catalogs/middlewares';

export default defineMiddlewares([...adminPdfCatalogsMiddlewares]);
