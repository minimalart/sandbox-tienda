import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { LOYALTY_MODULE } from '../modules/loyalty';
import type LoyaltyModuleService from '../modules/loyalty/service';
import { earnLoyaltyPointsWorkflow } from '../workflows/earn-loyalty-points';

// Awards signup earn rules (event 'signup') when a customer registers. Only
// fixed-amount rules produce points here (amount = 0). Idempotent per customer.
export default async function handleLoyaltySignup({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = event.data.id;
  if (!customerId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
    if (!(await loyalty.getActiveProgram())) return;

    const { result } = await earnLoyaltyPointsWorkflow(container).run({
      input: {
        customer_id: customerId,
        event: 'signup',
        amount: 0,
        reference: 'signup',
        reference_id: customerId,
      },
    });
    const total = (result?.awarded ?? []).reduce((s, a) => s + a.points, 0);
    if (total > 0) logger.info(`[Loyalty] Signup: awarded ${total} points to customer ${customerId}.`);
  } catch (error) {
    logger.error(`[Loyalty] Failed signup earn for customer ${customerId}: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'customer.created',
};
