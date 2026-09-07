import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { CreateDemoStoreSchema, UpdateDemoStoreSchema } from './schemas';

export const adminSitesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/sites',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateDemoStoreSchema)],
  },
  {
    matcher: '/admin/sites/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateDemoStoreSchema)],
  },
];
