import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { UpdateGa4MappingSchema } from './[id]/route';
import { CreateGa4MappingSchema } from './route';

export const adminGa4MappingsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/ga4-mappings',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateGa4MappingSchema)],
  },
  {
    matcher: '/admin/ga4-mappings/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateGa4MappingSchema)],
  },
];
