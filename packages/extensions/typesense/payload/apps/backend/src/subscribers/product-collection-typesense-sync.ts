import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { enqueueProductReindex } from '../modules/typesense/reindex-queue';

/**
 * Cambios de colección → reindexar sus productos.
 *
 * El documento indexa `collection.id` y `collection.title`, así que renombrar o
 * borrar una colección los dejaba stale hasta el próximo sync completo. Nadie
 * escuchaba estos eventos.
 */
export default async function productCollectionTypesenseSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const collectionId = event.data?.id;
  if (!collectionId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{ graph: (input: unknown) => Promise<{ data: unknown[] }> }>(
    ContainerRegistrationKeys.QUERY
  );

  try {
    const ids = new Set<string>();
    const PAGE = 200;
    for (let skip = 0; ; skip += PAGE) {
      const { data: products } = (await query.graph({
        entity: 'product',
        fields: ['id'],
        filters: { collection_id: collectionId },
        pagination: { skip, take: PAGE, order: { id: 'ASC' } },
      })) as { data: Array<{ id?: string | null }> };
      for (const product of products) {
        if (product.id) ids.add(product.id);
      }
      if (products.length < PAGE) break;
    }

    if (ids.size === 0) return;
    enqueueProductReindex(container, [...ids], `product-collection:${collectionId}`);
    logger.info(
      `[Typesense Sync] Colección ${collectionId}: ${ids.size} productos encolados.`
    );
  } catch (error) {
    logger.warn(
      `[Typesense Sync] No se pudieron encolar los productos de la colección ${collectionId}: ${(error as Error).message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: [
    'product-collection.created',
    'product-collection.updated',
    'product-collection.deleted',
  ],
};
