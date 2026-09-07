import { type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework';
import { tintingRateLimit } from './rate-limit';
import { PostStoreTintingLineItem, PostStoreTintingQuote } from './validators';

/**
 * Middlewares de las rutas store de tintometría. Registrados desde
 * src/api/extension-middlewares.ts. Sin `authenticate`: el PDP cotiza y agrega
 * al carrito sin cliente logueado (la publishable key ya se exige en /store/*).
 *
 * El rate limit corre PRIMERO, así bajo abuso no se parsea ni valida el body.
 */
export const storeTintingMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/tinting/quote',
    method: 'POST',
    middlewares: [tintingRateLimit, validateAndTransformBody(PostStoreTintingQuote)],
  },
  {
    matcher: '/store/tinting/line-items',
    method: 'POST',
    middlewares: [tintingRateLimit, validateAndTransformBody(PostStoreTintingLineItem)],
  },
  {
    // El flujo inverso: una consulta por color elegido. Entra al rate limit
    // porque es pública y hace varias queries; `/store/tinting/catalog` queda
    // afuera a propósito (es una sola lectura cacheada, no toca el ERP, y es lo
    // primero que carga la página).
    matcher: '/store/tinting/bases',
    method: 'GET',
    middlewares: [tintingRateLimit],
  },
];
