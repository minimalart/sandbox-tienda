import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { ConfirmBundleSchema } from './schemas';

export const storeBundlesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/bundles/confirm',
    method: ['POST'],
    middlewares: [validateAndTransformBody(ConfirmBundleSchema)],
  },
];
