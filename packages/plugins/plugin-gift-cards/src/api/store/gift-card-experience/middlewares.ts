import { authenticate, type MiddlewareRoute } from '@medusajs/framework/http';

export const storeGiftCardExperienceMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/gift-card-experience/landing/*/claim',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/gift-card-experience/wallet',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
];
