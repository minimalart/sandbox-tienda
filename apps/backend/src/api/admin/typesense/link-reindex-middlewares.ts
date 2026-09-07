import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { enqueueProductReindex } from '../../../modules/typesense/reindex-queue';

/**
 * Reindexado de los batch-link que NO avisan de ninguna forma.
 *
 * Verificado en `@medusajs/core-flows`: `batchProductsInCategoryWorkflow`,
 * `batchLinkProductsCollectionWorkflow` y `linkProductsToSalesChannelWorkflow`
 * no emiten eventos NI exponen hooks. Agregar o quitar productos desde la página
 * de una categoría, una colección o un sales channel dejaba el índice atrás
 * hasta el cron de 15 minutos.
 *
 * Un middleware que lea `add`/`remove` del body y encole esos ids cuando la
 * respuesta termina OK es el único camino en tiempo real. El de sales channel
 * importa especialmente: `sales_channels.id` es filtro DURO del storefront y es
 * lo que segmenta los demos, así que un producto recién vinculado no aparece en
 * absoluto hasta que se reindexa.
 */

type BatchLinkBody = { add?: unknown; remove?: unknown };

const asIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && !!id) : [];

const reindexAfterBatchLink =
  (source: string) =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): void => {
    const body = (req.body ?? {}) as BatchLinkBody;
    const productIds = [...asIds(body.add), ...asIds(body.remove)];

    if (productIds.length) {
      res.on('finish', () => {
        // Sólo si el link se aplicó de verdad.
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        try {
          enqueueProductReindex(req.scope, productIds, source);
        } catch (error) {
          // Nunca puede afectar la respuesta (ya se envió), pero tampoco tirar.
          try {
            req.scope
              .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
              .warn(
                `[Typesense Sync] ${source}: no se pudieron encolar ${productIds.length} productos: ${(error as Error).message}`
              );
          } catch {
            console.warn(`[Typesense Sync] ${source}: enqueue failed`, error);
          }
        }
      });
    }
    return next();
  };

export const typesenseLinkReindexMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/product-categories/:id/products',
    method: ['POST'],
    middlewares: [reindexAfterBatchLink('link:product-category')],
  },
  {
    matcher: '/admin/collections/:id/products',
    method: ['POST'],
    middlewares: [reindexAfterBatchLink('link:collection')],
  },
  {
    matcher: '/admin/sales-channels/:id/products',
    method: ['POST'],
    middlewares: [reindexAfterBatchLink('link:sales-channel')],
  },
];
