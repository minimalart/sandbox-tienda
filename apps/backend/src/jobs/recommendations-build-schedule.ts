import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { recommendationsJobsEnabled } from '../modules/recommendations/config';
import { enqueueDueBuilds } from '../modules/recommendations/recompute/schedule';

/**
 * Encola los recálculos que corresponde (PRD §13).
 *
 * Sólo decide y escribe a lo sumo una fila por estrategia: una lectura de lo pendiente
 * y otra de las estrategias. Ejecutar el cálculo es tarea del drainer
 * (`recommendations-build-run`), y esa separación es lo que garantiza que nunca corran
 * dos builds de la misma estrategia a la vez.
 *
 * Corre a los 5 minutos de cada hora, no cada minuto: el incidente del 2026-07-23 fue
 * un cron de 60s que clavó el vCPU compartido con el HTTP server.
 */
export default async function recommendationsBuildScheduleJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!recommendationsJobsEnabled()) return;

  try {
    const result = await enqueueDueBuilds(container);
    if (result.enqueued.length) {
      logger.info(`[recommendations-build-schedule] encoladas: ${result.enqueued.join(', ')}`);
    }
  } catch (error) {
    logger.error(
      `[recommendations-build-schedule] fallo: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const config = {
  name: 'recommendations-build-schedule',
  schedule: process.env.RECOMMENDATIONS_SCHEDULE_CRON || '5 * * * *',
};
