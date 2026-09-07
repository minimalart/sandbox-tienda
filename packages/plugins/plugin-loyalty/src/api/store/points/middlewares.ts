import { authenticate, MiddlewareRoute } from '@medusajs/framework/http';

// All points routes operate on the authenticated customer's own account.
export const storePointsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/points',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/points/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
];
