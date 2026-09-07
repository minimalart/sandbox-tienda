import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { startStockSync } from '../modules/erp/sync/run-stock-sync';

/**
 * Pull programado de stock ERP → Medusa (PRD §8.2 opción A). El intervalo
 * real lo gobierna este cron; con la integración o el sync deshabilitados el
 * tick es un no-op silencioso. Un tick que pisa un sync en curso recibe
 * CONFLICT y se retira sin ruido.
 */
export default async function erpStockSyncJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<ErpModuleService>(ERP_MODULE);

  const config = await service.getActiveConfig().catch(() => null);
  if (!config?.stock_sync_enabled) return;

  try {
    const { sync_log_id, completion } = await startStockSync(container, { trigger: 'cron' });
    logger.info(`[erp] cron: sincronización de stock ${sync_log_id} iniciada.`);
    await completion;
  } catch (error) {
    if (MedusaError.isMedusaError(error) && error.type === MedusaError.Types.CONFLICT) {
      logger.info('[erp] cron: ya hay una sincronización de stock en curso; tick ignorado.');
      return;
    }
    logger.error(
      `[erp] cron: la sincronización de stock no pudo arrancar: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const config = {
  name: 'erp-stock-sync',
  schedule: process.env.ERP_STOCK_SYNC_CRON || '0 * * * *',
};
