import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import {
  resolveCategorySubtreeIds,
  resolveProductIdsInCategories,
} from '../modules/typesense/category-descendants';
import { invalidateReindexCaches } from '../modules/typesense/reindex';
import { enqueueProductReindex } from '../modules/typesense/reindex-queue';

/**
 * Cambios de categoría → reindexar los productos afectados.
 *
 * `product-category.updated` SÍ se emite, pero NADIE lo escuchaba: renombrar o
 * re-parentear una categoría dejaba stale `categories.name`, `categories.lvl0/1/2`
 * y `category_path_label` de todos los productos descendientes hasta el próximo
 * sync completo. Por eso se resuelve el SUBÁRBOL, no sólo la categoría tocada.
 */
export default async function productCategoryTypesenseSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const categoryId = event.data?.id;
  if (!categoryId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{ graph: (input: unknown) => Promise<{ data: unknown[] }> }>(
    ContainerRegistrationKeys.QUERY
  );

  try {
    // El árbol cambió: el mapa cacheado de rutas ya no sirve.
    invalidateReindexCaches('categories');

    const subtree = await resolveCategorySubtreeIds(query, [categoryId]);
    const productIds = await resolveProductIdsInCategories(query, subtree);
    if (productIds.length === 0) return;

    enqueueProductReindex(container, productIds, `product-category:${categoryId}`);
    logger.info(
      `[Typesense Sync] Categoría ${categoryId}: ${productIds.length} productos encolados ` +
        `(${subtree.length} categorías del subárbol).`
    );
  } catch (error) {
    logger.warn(
      `[Typesense Sync] No se pudieron encolar los productos de la categoría ${categoryId}: ${(error as Error).message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: ['product-category.created', 'product-category.updated', 'product-category.deleted'],
};
