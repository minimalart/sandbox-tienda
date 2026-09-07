import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { processOutboxBatch } from '../modules/erp/outbox/process-outbox';
import { sweepStaleSyncLogs } from '../modules/erp/sync/run-stock-sync';

/**
 * Executor durable del outbox ERP (patrón process-demo-store-imports): cada
 * minuto envía los eventos vencidos con retry/backoff hasta dead_letter.
 * También barre sync logs `running` huérfanos para que un restart a mitad de
 * sync no deje el estado clavado hasta el próximo intento de sync.
 */
export default async function erpOutboxProcessorJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<ErpModuleService>(ERP_MODULE);

  const config = await service.getActiveConfig().catch(() => null);
  if (!config) return;

  try {
    const swept = await sweepStaleSyncLogs(container);
    if (swept) logger.warn(`[erp] cron: ${swept} sync log(s) huérfanos marcados como fallidos.`);
  } catch (error) {
    logger.warn(
      `[erp] cron: sweep de sync logs falló: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    await processOutboxBatch(container);
  } catch (error) {
    logger.warn(
      `[erp] cron: el processor del outbox falló: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const config = {
  name: 'erp-outbox-processor',
  schedule: process.env.ERP_OUTBOX_CRON || '* * * * *',
};
