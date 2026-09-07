import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../modules/gift-card-experience/service';

/** Cancels only unissued intents. Official cards already issued remain untouched. */
export default async function giftCardOrderCanceled({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const service = container.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
    const canceled = await service.cancelUnissuedDeliveriesForOrder(event.data.id);
    if (canceled > 0) {
      logger.info(`[Gift Card] ${canceled} unissued intent(s) canceled for order ${event.data.id}.`);
    }
  } catch (error) {
    logger.error(`[Gift Card] order.canceled reconciliation failed for ${event.data.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const config: SubscriberConfig = { event: 'order.canceled' };
