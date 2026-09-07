import { type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework';
import { recommendationsRateLimit } from './rate-limit';
import { PostStoreRecommendationEvents, PostStoreRecommendations } from './validators';

/**
 * Middlewares de las rutas store de recomendaciones. Se registran desde
 * `src/api/extension-middlewares.ts` (archivo GENERADO por
 * `pnpm site:components:extract` a partir de
 * `packages/project-composer/src/extension-integrations.js`).
 *
 * Sin `authenticate`: el storefront pide recomendaciones para visitantes anónimos y
 * la publishable key ya se exige por default en `/store/*`.
 */
export const storeRecommendationsMiddlewares: MiddlewareRoute[] = [
  {
    // Antes que `/store/recommendations`: Express matchea en orden de registro y una
    // ruta más específica registrada después nunca se alcanzaría.
    matcher: '/store/recommendations/events',
    method: 'POST',
    middlewares: [
      recommendationsRateLimit,
      validateAndTransformBody(PostStoreRecommendationEvents),
    ],
  },
  {
    matcher: '/store/recommendations',
    method: 'POST',
    // El rate limit corre primero: bajo abuso ni se parsea ni se valida el body.
    middlewares: [recommendationsRateLimit, validateAndTransformBody(PostStoreRecommendations)],
  },
];
