import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { TYPESENSE_SYNC_LOG_MODULE } from '../modules/typesense/sync-log';
import type TypesenseSyncLogService from '../modules/typesense/sync-log/service';
import { getTypesenseSettings } from '../modules/typesense/settings';

/**
 * Retención del historial de sincronizaciones.
 *
 * Con el cron de reconciliación cada 15 minutos son ~96 filas por día: sin podar
 * la tabla crece para siempre y el listado del admin se vuelve inútil. Borra las
 * corridas (y sus items) anteriores a TYPESENSE_SYNC_LOG_RETENTION_DAYS (30 por
 * defecto), en tandas para no hacer un DELETE gigante.
 */

const BATCH = 200;

export default async function typesenseSyncLogPruneJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const days = getTypesenseSettings().syncLogRetentionDays;
  if (days <= 0) return;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const service = container.resolve<TypesenseSyncLogService>(TYPESENSE_SYNC_LOG_MODULE);

  let logsDeleted = 0;
  let itemsDeleted = 0;

  try {
    for (;;) {
      const stale = (await service.listTypesenseSyncLogs(
        { started_at: { $lt: cutoff } },
        { take: BATCH, order: { started_at: 'ASC' } }
      )) as Array<{ id: string }>;
      if (stale.length === 0) break;

      const logIds = stale.map((log) => log.id);
      // Los items primero: el FK es plano, así que borrar el log no los arrastra.
      const items = (await service.listTypesenseSyncLogItems(
        { sync_log_id: logIds },
        { take: 10_000 }
      )) as Array<{ id: string }>;
      if (items.length) {
        await service.deleteTypesenseSyncLogItems(items.map((item) => item.id));
        itemsDeleted += items.length;
      }
      await service.deleteTypesenseSyncLogs(logIds);
      logsDeleted += logIds.length;

      if (stale.length < BATCH) break;
    }

    if (logsDeleted) {
      logger.info(
        `[Typesense Prune] Borradas ${logsDeleted} corridas y ${itemsDeleted} items anteriores a ${cutoff.toISOString()}.`
      );
    }
  } catch (error) {
    logger.warn(
      `[Typesense Prune] falló: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const config = {
  name: 'typesense-sync-log-prune',
  schedule: process.env.TYPESENSE_SYNC_LOG_PRUNE_CRON || '30 4 * * *',
};
