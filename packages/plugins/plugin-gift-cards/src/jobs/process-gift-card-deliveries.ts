import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { processGiftCardDeliveryBatch } from '../modules/gift-card-experience/delivery';

export default async function processGiftCardDeliveries(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    await processGiftCardDeliveryBatch(container);
  } catch (error) {
    logger.error(`[Gift Card] Delivery outbox failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const config = { name: 'gift-card-delivery-outbox', schedule: '* * * * *' };
