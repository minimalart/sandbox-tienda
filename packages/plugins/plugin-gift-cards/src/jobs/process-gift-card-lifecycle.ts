import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { processGiftCardLifecycle } from '../modules/gift-card-experience/lifecycle';

export default async function processGiftCardLifecycleJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    await processGiftCardLifecycle(container);
  } catch (error) {
    logger.error(`[Gift Card] Lifecycle notifications failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const config = { name: 'gift-card-lifecycle-notifications', schedule: '0 10 * * *' };
