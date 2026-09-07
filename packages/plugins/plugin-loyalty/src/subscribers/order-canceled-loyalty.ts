import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { reverseLoyaltyPointsWorkflow } from '../workflows/reverse-loyalty-points';

// A canceled order claws back the points it earned. Idempotent (keys off each
// original earn txn), so a duplicate event never double-reverses.
export default async function handleLoyaltyOrderCanceled({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'customer_id'],
    filters: { id: orderId },
  })) as { data: Array<{ id: string; customer_id: string | null }> };

  const order = orders[0];
  if (!order?.customer_id) return;

  try {
    const { result } = await reverseLoyaltyPointsWorkflow(container).run({
      input: { customer_id: order.customer_id, reference: 'order', reference_id: order.id },
    });
    logger.info(`[Loyalty] Order ${order.id} canceled: reversed ${result?.reversed ?? 0} points.`);
  } catch (error) {
    logger.error(`[Loyalty] Failed to reverse points for canceled order ${order.id}: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
};
