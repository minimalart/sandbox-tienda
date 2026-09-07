import { authenticate, MiddlewareRoute } from '@medusajs/framework/http';

// La ruta de vinculación de Google acepta un token bearer SIN actor_id: el token
// recién emitido por Google cuya auth identity todavía no está ligada a ningún
// customer. `allowUnregistered` permite poblar `req.auth_context` desde el
// `auth_identity_id` solo; sin esto, el token sin actor_id daría 401.
export const storeAuthMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/auth/google/link',
    method: ['POST'],
    middlewares: [
      authenticate('customer', ['bearer', 'session'], {
        allowUnregistered: true,
      }),
    ],
  },
];
