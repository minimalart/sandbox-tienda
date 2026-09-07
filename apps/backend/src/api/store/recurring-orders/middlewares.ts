import { authenticate, MiddlewareRoute } from '@medusajs/framework/http';

// Todas las rutas operan sobre las suscripciones del customer autenticado.
export const storeRecurringOrdersMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/recurring-orders',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/recurring-orders/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
];
