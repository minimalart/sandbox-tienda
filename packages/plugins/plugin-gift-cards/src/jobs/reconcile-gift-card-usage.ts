import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../modules/gift-card-experience/service';
import { getGiftCardExperienceSettings } from '../modules/gift-card-experience/settings';

export default async function reconcileGiftCardUsage(container: MedusaContainer): Promise<void> {
  // Kill switch de despliegue. El `schedule` de abajo NO se puede mover en
  // runtime (job-loader.js hornea el cron al arrancar), así que apagar la
  // extensión desde el admin es este early return.
  if (!getGiftCardExperienceSettings().experienceEnabled) return;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const service = container.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
    // `null` EXPLÍCITO: el kill switch que se mira sigue siendo el de la fila global,
    // para una reconciliación que sella hitos sobre las entregas de TODAS las tiendas.
    // Queda `pending` en `job-scope.ts`; moverlo pide que `reconcileUsageMilestones()`
    // filtre por tienda, no que este `getSettings` reciba otra cosa.
    const settings = await service.getSettings(null);
    if (!settings.enabled) return;
    await service.reconcileUsageMilestones();
  } catch (error) {
    logger.error(`[Gift Card] Usage reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const config = { name: 'gift-card-usage-reconciliation', schedule: '*/15 * * * *' };
