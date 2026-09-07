import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import TypeSenseService from '../modules/typesense/service';

export default async function productDeletedTypesenseSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data.id;
  if (!productId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const typeSenseService = new TypeSenseService();

  try {
    const deleted = await typeSenseService.deleteDocumentInDb(productId);
    if (deleted) {
      logger.info(`[Typesense Sync] Removed deleted product ${productId} from Typesense`);
    } else {
      logger.warn(
        `[Typesense Sync] Could not remove ${productId} from Typesense after deletion`
      );
    }
  } catch (error) {
    logger.warn(
      `[Typesense Sync] Failed to remove deleted product ${productId}: ${(error as Error).message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: 'product.deleted',
};
