import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { enqueueProductReindex } from '../modules/typesense/reindex-queue';

/**
 * Reindexa en Typesense los productos cuyos precios cambió el catalog sync del ERP.
 *
 * Existe como subscriber (y no como llamada directa dentro del motor de sync)
 * para que la extensión ERP no dependa de la de Typesense: el motor emite
 * `erp.catalog-prices-updated` y acá se reacciona. Si Typesense no está
 * instalado, este archivo no existe, nadie escucha el evento y los precios los
 * arrastra `typesense-stock-reconcile` en su pasada periódica.
 *
 * El nombre del evento va como literal a propósito: importar la constante del
 * módulo `erp` acoplaría este archivo a las dos extensiones y el extractor de
 * componentes no podría asignarle un dueño único.
 *
 * Llega UN evento por corrida con todos los productos juntos, así que el reindex
 * es una sola pasada batcheada y no una por variante.
 */
export default async function erpCatalogTypesenseSyncHandler({
  event,
  container,
}: SubscriberArgs<{ product_ids?: string[]; sync_log_id?: string }>) {
  const productIds = event.data?.product_ids ?? [];
  if (!productIds.length) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    enqueueProductReindex(
      container,
      productIds,
      `erp.catalog-prices-updated:${event.data?.sync_log_id ?? '?'}`
    );
    logger.info(
      `[Typesense Sync] Catalog sync ${event.data?.sync_log_id ?? '?'}: ` +
        `${productIds.length} producto(s) con cambios de precio encolados para reindexar.`
    );
  } catch (error) {
    // Nunca propagar: los precios ya están bien en la base y el reconcile
    // periódico termina arrastrándolos al índice.
    logger.warn(
      `[Typesense Sync] No se pudo encolar los ${productIds.length} producto(s) del catalog sync: ` +
        `${(error as Error).message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: 'erp.catalog-prices-updated',
};
