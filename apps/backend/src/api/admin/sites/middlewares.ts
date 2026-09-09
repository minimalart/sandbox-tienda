import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { CreateDemoStoreSchema, UpdateDemoStoreSchema } from './schemas';
import { checkoutMiddlewares } from '../../../modules/demo-store/checkout/middlewares';

export const adminSitesMiddlewares: MiddlewareRoute[] = [
  ...checkoutMiddlewares,
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
