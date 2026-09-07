import { authenticate, MiddlewareRoute } from '@medusajs/framework/http';

// Rutas de empresa mayorista: customer autenticado. El lookup público de
// invitación vive en /store/company-invitations/:token (fuera de acá).
export const storeCompaniesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/companies',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/companies/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/b2b/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
];
