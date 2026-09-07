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
import { defineMiddlewares } from '@medusajs/framework/http';

export default defineMiddlewares([]);
