import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import {
  AdminCreateVideoSchema,
  AdminUpdateVideoSchema,
  AdminLinkProductsSchema,
  AdminUnlinkProductsSchema,
} from './validators';

export const adminVideosMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/videos',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateVideoSchema as any)],
  },
  {
    matcher: '/admin/videos/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminUpdateVideoSchema as any)],
  },
  {
    matcher: '/admin/videos/:id/products',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminLinkProductsSchema as any)],
  },
  {
    matcher: '/admin/videos/:id/products',
    method: ['DELETE'],
    middlewares: [validateAndTransformBody(AdminUnlinkProductsSchema as any)],
  },
];
