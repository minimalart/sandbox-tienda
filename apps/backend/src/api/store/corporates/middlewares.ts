import { authenticate, MiddlewareRoute } from '@medusajs/framework/http';

// Todas las rutas /store/corporates operan sobre el customer autenticado.
// (El lookup público de invitación vive en /store/corporate-invitations/:token).
export const storeCorporatesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/corporates',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/corporates/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
];
