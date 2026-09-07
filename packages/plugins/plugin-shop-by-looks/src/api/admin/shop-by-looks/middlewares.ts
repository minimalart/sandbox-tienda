import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { UpdateShopByLookSchema } from './[look_id]/route';
import { CreateShopByLookSchema } from './route';

export const adminShopByLooksMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/shop-by-looks',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateShopByLookSchema)],
  },
  {
    matcher: '/admin/shop-by-looks/:look_id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateShopByLookSchema)],
  },
];
