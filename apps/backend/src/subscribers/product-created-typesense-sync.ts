import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { enqueueProductReindex } from '../modules/typesense/reindex-queue';

/**
 * Encola en vez de reindexar en el acto: un import masivo emite un
 * `product.created` por producto y cada reindexado directo reconstruía el mapa
 * completo de categorías + promociones. La cola agrupa la ráfaga en unos pocos
 * barridos y loguea el resultado (ver `reindex-queue.ts`).
 */
export default async function productCreatedTypesenseSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data?.id;
  if (!productId) return;
  enqueueProductReindex(container, [productId], 'product.created');
}

export const config: SubscriberConfig = {
  event: 'product.created',
};
