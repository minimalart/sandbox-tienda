import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DYNAMIC_GROUPS_MODULE } from '../modules/dynamic-groups';
import type DynamicGroupsModuleService from '../modules/dynamic-groups/service';
import { recalculateDynamicGroupWorkflow } from '../workflows/recalculate-dynamic-group';

/**
 * Barrido periódico de grupos dinámicos. Necesario para reglas TEMPORALES que
 * no disparan por evento: inactividad ("días sin comprar"), "cumpleaños del
 * mes", antigüedad. También reconcilia cualquier deriva. El tiempo real
 * (subscribers) cubre las transiciones por compra/alta; este cron cubre el resto.
 *
 * Schedule configurable con DYNAMIC_GROUPS_RECALC_CRON (default: 3am diario).
 */
export default async function recalculateDynamicGroupsJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<DynamicGroupsModuleService>(
    DYNAMIC_GROUPS_MODULE,
  );

  const groups = await service.listDynamicGroups({ is_active: true });
  let ok = 0;
  let fail = 0;

  for (const g of groups) {
    if (!g.customer_group_id) continue;
    try {
      const { result } = await recalculateDynamicGroupWorkflow(container).run({
        input: { id: g.id as string },
      });
      ok++;
      logger.info(
        `[DynamicGroups cron] "${g.name}": ${result.members} miembros (+${result.added}/-${result.removed})`,
      );
    } catch (e) {
      fail++;
      logger.warn(
        `[DynamicGroups cron] "${g.name}" falló: ${(e as Error).message}`,
      );
    }
  }

  logger.info(
    `[DynamicGroups cron] recalculados ${ok} grupos (${fail} con error).`,
  );
}

export const config = {
  name: 'recalculate-dynamic-groups',
  schedule: process.env.DYNAMIC_GROUPS_RECALC_CRON || '0 3 * * *',
};
