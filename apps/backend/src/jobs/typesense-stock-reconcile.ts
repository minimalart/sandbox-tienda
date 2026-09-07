import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { startTypesenseSync } from '../modules/typesense/run-sync';
import { getTypesenseSettings } from '../modules/typesense/settings';

/**
 * Reconciliación periódica de Typesense.
 *
 * Los subscribers cubren en tiempo real las ediciones de producto, categoría,
 * colección y promoción, pero en Medusa v2 los cambios de STOCK por nivel de
 * ubicación NO emiten evento (los workflows de inventory no llaman a
 * emitEventStep). Este cron hace un barrido `update` de todos los productos
 * publicados para mantener `stock_available` (y precio/promos) al día.
 *
 * Pasa por `startTypesenseSync` en vez de tener su propio barrido: así hereda
 * gratis el import por tandas, el borrado de huérfanos, la fila de log con
 * progreso y el guard de concurrencia contra el botón del admin. Antes eran dos
 * implementaciones del mismo barrido y ya habían divergido.
 *
 * Intervalo configurable con TYPESENSE_RECONCILE_CRON. Se puede desactivar con
 * TYPESENSE_RECONCILE_ENABLED=false (p. ej. en catálogos enormes donde el
 * barrido completo sea caro y se prefiera un sync manual).
 */
export default async function typesenseStockReconcileJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  // Se configura desde el admin (Typesense → Mantenimiento). El cron en sí
  // sigue en env: Medusa lo hornea al arrancar y no se puede reprogramar.
  if (!getTypesenseSettings().reconcileEnabled) return;

  try {
    const { sync_log_id, completion } = await startTypesenseSync(container, {
      mode: 'update',
      trigger: 'cron',
    });
    // El cron sí espera: si tarda más que el intervalo, el guard de concurrencia
    // hace que el tick siguiente se saltee en vez de solaparse.
    await completion;
    logger.info(`[Typesense Reconcile] cron listo (log ${sync_log_id}).`);
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.CONFLICT) {
      // Ya hay una corrida en curso (manual o el tick anterior): no es un fallo.
      logger.info('[Typesense Reconcile] cron salteado: ya hay una sincronización en curso.');
      return;
    }
    logger.warn(
      `[Typesense Reconcile] cron failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const config = {
  name: 'typesense-stock-reconcile',
  schedule: process.env.TYPESENSE_RECONCILE_CRON || '*/15 * * * *',
};
