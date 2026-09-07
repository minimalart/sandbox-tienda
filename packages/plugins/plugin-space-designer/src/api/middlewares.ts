import { authenticate, defineMiddlewares } from '@medusajs/framework/http';
export default defineMiddlewares([
  {
    matcher: '/admin/space-designer/*',
    middlewares: [authenticate('user', ['session', 'bearer', 'api-key'])],
  },
  {
    matcher: '/store/space-designer/*',
    middlewares: [authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true })],
  },
  {
    matcher: '/store/space-designer/designs',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/space-designer/designs/:id',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
]);
