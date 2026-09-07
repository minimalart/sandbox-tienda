import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { POINTS_MODULE } from '../modules/points';
import type PointsModuleService from '../modules/points/service';

// Expires loyalty point lots whose `expires_at` has passed. The expiry date is
// stamped at earn time per the program's expiration policy; this job only
// realizes due lots. Idempotent (already-expired lots aren't matched again).
export const config = {
  name: 'expire-loyalty-points',
  schedule: process.env.LOYALTY_EXPIRE_SCHEDULE || '0 3 * * *', // daily at 03:00
};

export default async function expireLoyaltyPointsJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const points = container.resolve<PointsModuleService>(POINTS_MODULE);
    const { expired } = await points.expireDueLots(new Date());
    if (expired > 0) logger.info(`[Loyalty] Expired ${expired} point lot(s).`);
  } catch (error) {
    logger.error(`[Loyalty] expire-loyalty-points failed: ${(error as Error).message}`);
  }
}
