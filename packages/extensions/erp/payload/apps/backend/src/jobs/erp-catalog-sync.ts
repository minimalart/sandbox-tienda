import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { shouldFullSweep } from '../modules/erp/sync/full-sweep-schedule';
import { startCatalogSync } from '../modules/erp/sync/run-catalog-sync';

/**
 * Pull programado de catálogo (productos + listas de precios) ERP → Medusa.
 *
 * El intervalo lo gobierna `ERP_CATALOG_SYNC_CRON`. Arranca en 15 minutos y no en
 * 1 a propósito: cada tick hace una llamada al ERP que trae el catálogo completo
 * y recorre todas las variantes de Medusa, y ya tuvimos un incidente de CPU al
 * 100% con un cron de 60 segundos haciendo trabajo pesado en 1 vCPU.
 *
 * Con la integración o el sync deshabilitados el tick es un no-op silencioso. Un
 * tick que pisa un sync en curso recibe CONFLICT y se retira sin ruido.
 *
 * El reindex de la búsqueda NO se hace acá: el motor emite
 * `erp.catalog-prices-updated` y lo atiende el subscriber
 * `erp-catalog-typesense-sync`, para que la extensión ERP no dependa de Typesense.
 */
export default async function erpCatalogSyncJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<ErpModuleService>(ERP_MODULE);

  const config = await service.getActiveConfig().catch(() => null);
  if (!config?.catalog_sync_enabled) return;

  // Barrido completo (sin `fechasincro`) una vez por día: Zeus no informa bajas,
  // así que el delta solo no alcanza para detectar un artículo despublicado. Que
  // el barrido sea UNO y no uno por tick lo decide `shouldFullSweep` contra la
  // marca `last_full_sweep_at`; quien ACTÚA sobre las bajas es `status_sync`.
  const catalogSettings = config.settings?.catalog_sync;
  const fullSweep = shouldFullSweep(
    { full_sweep_hour: catalogSettings?.full_sweep_hour ?? 4, last_full_sweep_at: catalogSettings?.last_full_sweep_at },
    new Date()
  );

  try {
    const { sync_log_id, completion } = await startCatalogSync(container, {
      trigger: 'cron',
      fullSweep,
    });
    logger.info(
      `[erp] cron: sincronización de catálogo ${sync_log_id} iniciada${fullSweep ? ' (barrido completo)' : ''}.`
    );
    await completion;
  } catch (error) {
    if (MedusaError.isMedusaError(error) && error.type === MedusaError.Types.CONFLICT) {
      logger.info('[erp] cron: ya hay una sincronización de catálogo en curso; tick ignorado.');
      return;
    }
    logger.error(
      `[erp] cron: la sincronización de catálogo no pudo arrancar: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const config = {
  name: 'erp-catalog-sync',
  schedule: process.env.ERP_CATALOG_SYNC_CRON || '*/15 * * * *',
};
