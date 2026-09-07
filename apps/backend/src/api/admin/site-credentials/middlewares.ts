import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { UpsertSiteCredentialSchema } from './schemas';

export const adminSiteCredentialsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/site-credentials',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpsertSiteCredentialSchema)],
  },
];
