import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { enqueueProductReindex } from '../modules/typesense/reindex-queue';

/**
 * Reindexa el producto padre cuando cambia una variante.
 *
 * En Medusa v2 editar el PRECIO base de una variante NO emite `product.updated`
 * — pasa por `updateProductVariantsWorkflow`, que emite `product-variant.updated`
 * con `{ id }` = id de la variante. Sin este subscriber, cambiar un precio
 * dejaba Typesense con el precio viejo hasta el próximo full-sync manual.
 *
 * El id del evento es de la VARIANTE; resolvemos su `product_id` y reindexamos
 * el producto completo (el documento se arma por producto, no por variante).
 *
 * Solo escuchamos `.updated` a propósito: `.created` dispararía N reindexados
 * redundantes al crear un producto (uno por variante, además del que ya hace
 * `product.created`) → tormenta en imports masivos. Variantes nuevas en
 * productos existentes y `.deleted` los cubre el job de reconciliación.
 */
export default async function productVariantTypesenseSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const variantId = event.data.id;
  if (!variantId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const query = container.resolve<{
      graph: (input: unknown) => Promise<{ data: unknown[] }>;
    }>(ContainerRegistrationKeys.QUERY);

    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: ['product_id'],
      filters: { id: [variantId] },
    })) as { data: Array<{ product_id?: string }> };

    const productId = variants[0]?.product_id;
    if (!productId) {
      logger.info(
        `[Typesense Sync] Variant ${variantId} has no resolvable product (deleted?); skipping`
      );
      return;
    }

    // Se encola: una actualización de precios en lote emite un evento por
    // variante y cada reindexado directo rearmaba categorías + promociones.
    enqueueProductReindex(container, [productId], 'product-variant.updated');
  } catch (error) {
    logger.warn(
      `[Typesense Sync] Failed to reindex product for variant ${variantId}: ${(error as Error).message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: 'product-variant.updated',
};
