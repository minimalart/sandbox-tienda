import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { enqueueProductReindex } from '../modules/typesense/reindex-queue';

/**
 * Encola en vez de reindexar en el acto: una edición en lote (Catalogador,
 * import) emite un `product.updated` por producto y cada reindexado directo
 * reconstruía el mapa completo de categorías + promociones. La cola agrupa la
 * ráfaga en unos pocos barridos (ver `reindex-queue.ts`).
 */
export default async function productUpdatedTypesenseSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data?.id;
  if (!productId) return;
  enqueueProductReindex(container, [productId], 'product.updated');
}

export const config: SubscriberConfig = {
  event: 'product.updated',
};
