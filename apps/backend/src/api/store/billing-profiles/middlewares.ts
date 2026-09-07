import { authenticate, MiddlewareRoute } from '@medusajs/framework/http';

// Los perfiles de facturación son del customer autenticado. La asociación al
// cart (/store/carts/:id/billing-profile) NO va acá: soporta guest checkout.
export const storeBillingProfilesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/billing-profiles',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/billing-profiles/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
];
