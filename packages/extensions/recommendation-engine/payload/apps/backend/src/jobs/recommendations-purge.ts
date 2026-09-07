import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { recommendationsJobsEnabled } from '../modules/recommendations/config';
import { purgeRecommendationData } from '../modules/recommendations/events/purge';

/**
 * Purga de datos del motor de recomendaciones (PRD §13.5).
 *
 * Corre una vez por día, de madrugada. Es la única tarea del motor que borra, y borra
 * en lotes acotados: los eventos crudos son la tabla de mayor volumen de la extensión
 * y un DELETE masivo en un contenedor de 1 vCPU se ve como un incidente.
 *
 * El kill switch se chequea ANTES de tocar la base, para que apagarlo sirva incluso
 * cuando la base es el problema.
 */
export default async function recommendationsPurgeJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!recommendationsJobsEnabled()) return;

  try {
    const result = await purgeRecommendationData(container);
    if (result.batches === 0) return;
    logger.info(
      `[recommendations-purge] eventos: ${result.events_deleted} · métricas horarias: ${result.hourly_metrics_deleted} · relaciones viejas: ${result.stale_relations_deleted}${
        result.truncated ? ' · quedó trabajo pendiente para la próxima corrida' : ''
      }`,
    );
  } catch (error) {
    // Nunca se propaga: un fallo de purga no puede tumbar el scheduler.
    logger.error(
      `[recommendations-purge] fallo: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const config = {
  name: 'recommendations-purge',
  schedule: process.env.RECOMMENDATIONS_PURGE_CRON || '40 3 * * *',
};
