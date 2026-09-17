import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import {
  CreateBundleItemSchema,
  CreateBundleSchema,
  SetBundleStoresSchema,
  UpdateBundleItemSchema,
  UpdateBundleSchema,
} from './schemas';

/**
 * Bundle admin middlewares. Registered from `src/api/extension-middlewares.ts`.
 * The generator strips this import in projects that don't opt into the
 * `bundle` extension, so this file (and the module) can be absent without
 * breaking the boot.
 */
export const adminBundlesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/bundles',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateBundleSchema)],
  },
  {
    matcher: '/admin/bundles/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateBundleSchema)],
  },
  {
    matcher: '/admin/bundles/:id/items',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateBundleItemSchema)],
  },
  {
    matcher: '/admin/bundles/:id/items/:itemId',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateBundleItemSchema)],
  },
  {
    matcher: '/admin/bundles/:id/stores',
    method: ['POST'],
    middlewares: [validateAndTransformBody(SetBundleStoresSchema)],
  },
];
