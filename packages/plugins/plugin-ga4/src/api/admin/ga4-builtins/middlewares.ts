import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { UpdateGa4BuiltinSchema } from './[key]/route';

export const adminGa4BuiltinsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/ga4-builtins/:key',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateGa4BuiltinSchema)],
  },
];
