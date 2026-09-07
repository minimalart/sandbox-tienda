import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { CatalogadorConfigSchema } from './config/route';
import { CreateExecutionSchema } from './executions/route';
import { UpdateExecutionSchema } from './executions/[id]/route';
import { SelectionPreviewSchema } from './selection/preview/route';
import { GenerateExecutionSchema } from './executions/[id]/generate/route';
import { ReviewProductSchema } from './executions/[id]/products/[pid]/route';
import { UpdateCompositionSchema } from './executions/[id]/assets/[aid]/composition/route';

/**
 * Validación de bodies del Catalogador. Se agregan en
 * apps/backend/src/api/extension-middlewares.ts (generado por el composer a
 * partir de extension-integrations.js). La autenticación admin la aplica Medusa
 * por el prefijo /admin.
 */
export const adminCatalogadorMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/catalogador/config',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CatalogadorConfigSchema)],
  },
  {
    matcher: '/admin/catalogador/executions',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateExecutionSchema)],
  },
  {
    matcher: '/admin/catalogador/executions/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateExecutionSchema)],
  },
  {
    matcher: '/admin/catalogador/executions/:id/generate',
    method: ['POST'],
    middlewares: [validateAndTransformBody(GenerateExecutionSchema)],
  },
  {
    matcher: '/admin/catalogador/executions/:id/products/:pid',
    method: ['POST'],
    middlewares: [validateAndTransformBody(ReviewProductSchema)],
  },
  {
    matcher: '/admin/catalogador/executions/:id/assets/:aid/composition',
    method: ['PATCH'],
    middlewares: [validateAndTransformBody(UpdateCompositionSchema)],
  },
  {
    matcher: '/admin/catalogador/selection/preview',
    method: ['POST'],
    middlewares: [validateAndTransformBody(SelectionPreviewSchema)],
  },
];
