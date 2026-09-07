import { type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework';
import { arcaRateLimit } from './rate-limit';
import { PostArcaTaxpayerLookup } from './taxpayer-lookup/validators';

/**
 * Middlewares de las rutas store de ARCA. Registrados desde
 * src/api/extension-middlewares.ts. Sin authenticate: el checkout soporta
 * guest y la publishable key ya se exige por default en /store/*.
 */
export const storeArcaMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/arca/taxpayer-lookup',
    method: 'POST',
    // El rate limit corre primero: bajo abuso ni se parsea/valida el body.
    middlewares: [arcaRateLimit, validateAndTransformBody(PostArcaTaxpayerLookup)],
  },
];
