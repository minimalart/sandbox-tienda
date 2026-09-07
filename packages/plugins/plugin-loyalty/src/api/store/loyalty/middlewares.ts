import { authenticate, type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { RedeemSchema } from './validators';

// All loyalty store routes operate on the authenticated customer.
export const storeLoyaltyMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/loyalty/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/loyalty/redeem',
    method: ['POST'],
    middlewares: [validateAndTransformBody(RedeemSchema)],
  },
];
