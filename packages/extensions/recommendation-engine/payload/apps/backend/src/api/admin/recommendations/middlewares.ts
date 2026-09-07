import {
  type MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework';
import {
  BulkCreateRecommendationRelations,
  CreateRecommendationRelation,
  ListRecommendationRelationsQuery,
  PreviewRecommendations,
  SearchRecommendationProductsQuery,
  UpdateRecommendationPlacement,
  UpdateRecommendationRelation,
  UpdateRecommendationsConfig,
  UpdateRecommendationStrategy,
} from './validators';

/**
 * Middlewares de las rutas admin del motor de recomendaciones. Se registran desde
 * `src/api/extension-middlewares.ts` (archivo GENERADO por
 * `pnpm site:components:extract`).
 *
 * Sin `authenticate`: Medusa aplica la autenticación de admin a todo el prefijo
 * `/admin`. Acá sólo va la validación de body y query.
 *
 * El repo NO tiene RBAC (el único caso, gift-card-experience, es un stub que concede
 * todo), así que los permisos que propone el PRD §21 no están implementados: todo
 * usuario administrativo autenticado tiene acceso completo. Es un gap conocido y
 * explícito, no un olvido.
 */
export const adminRecommendationsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/recommendations/config',
    method: 'POST',
    middlewares: [validateAndTransformBody(UpdateRecommendationsConfig)],
  },
  {
    matcher: '/admin/recommendations/strategies/:id',
    method: 'POST',
    middlewares: [validateAndTransformBody(UpdateRecommendationStrategy)],
  },
  {
    matcher: '/admin/recommendations/placements/:id',
    method: 'POST',
    middlewares: [validateAndTransformBody(UpdateRecommendationPlacement)],
  },
  {
    matcher: '/admin/recommendations/relations',
    method: 'GET',
    middlewares: [
      validateAndTransformQuery(ListRecommendationRelationsQuery, { isList: true }),
    ],
  },
  {
    matcher: '/admin/recommendations/relations',
    method: 'POST',
    middlewares: [validateAndTransformBody(CreateRecommendationRelation)],
  },
  {
    // Antes que `/relations/:id`: Express matchea en orden de registro y `bulk`
    // entraría como un `:id` cualquiera.
    matcher: '/admin/recommendations/relations/bulk',
    method: 'POST',
    middlewares: [validateAndTransformBody(BulkCreateRecommendationRelations)],
  },
  {
    matcher: '/admin/recommendations/relations/:id',
    method: 'POST',
    middlewares: [validateAndTransformBody(UpdateRecommendationRelation)],
  },
  {
    matcher: '/admin/recommendations/products',
    method: 'GET',
    middlewares: [
      validateAndTransformQuery(SearchRecommendationProductsQuery, { isList: true }),
    ],
  },
  {
    matcher: '/admin/recommendations/preview',
    method: 'POST',
    middlewares: [validateAndTransformBody(PreviewRecommendations)],
  },
];
