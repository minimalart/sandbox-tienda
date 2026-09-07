import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { processGiftCardsForOrder } from '../modules/gift-card-experience/process-order';
import { resolveOrderIdFromPayment } from '../utils/order-from-payment';

export default async function giftCardPaymentCaptured({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const orderId = await resolveOrderIdFromPayment(container, event.data.id);
    if (!orderId) return; // order.placed performs the race reconciliation.
    await processGiftCardsForOrder(container, orderId);
  } catch (error) {
    logger.error(`[Gift Card] payment.captured processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const config: SubscriberConfig = { event: 'payment.captured' };
