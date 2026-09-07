import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { processGiftCardsForOrder } from '../modules/gift-card-experience/process-order';

/** Creates idempotent intents and reconciles the capture-before-order race. */
export default async function giftCardOrderPlaced({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const result = await processGiftCardsForOrder(container, event.data.id);
    if (result.intentCount > 0) {
      logger.info(`[Gift Card] ${result.intentCount} intent(s) reconciled for order ${event.data.id}; paid=${result.paid}.`);
    }
  } catch (error) {
    logger.error(`[Gift Card] order.placed reconciliation failed for ${event.data.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const config: SubscriberConfig = { event: 'order.placed' };
