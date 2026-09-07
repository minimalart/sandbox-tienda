import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { RECOMMENDATION_ENGINE_MODULE } from '../modules/recommendations';
import { recommendationsJobsEnabled } from '../modules/recommendations/config';
import { runBuild, type VersionRow } from '../modules/recommendations/recompute/run-build';
import type RecommendationEngineModuleService from '../modules/recommendations/service';
import { getRecommendationsSettings } from '../modules/recommendations/settings';

/**
 * Drena la cola de recálculos: toma UNA corrida pendiente y la ejecuta con presupuesto
 * de tiempo acotado.
 *
 * Tres cosas que hacen que esto sea seguro en un contenedor de 1 vCPU compartido con el
 * HTTP server:
 *
 *  1. Corre cada 10 minutos, no cada minuto (el incidente del 2026-07-23 fue
 *     exactamente eso), y en el ~99% de los ticks sale en menos de un milisegundo: la
 *     primera sentencia es un `take: 1` sobre el índice `(status, updated_at)`.
 *  2. Ejecuta UNA corrida por tick, nunca todas las pendientes.
 *  3. `runBuild` respeta `RECOMMENDATIONS_BUILD_MAX_MS` y puede devolver `in_progress`,
 *     dejando el trabajo a medias con su cursor para el próximo tick.
 *
 * Antes de tomar trabajo nuevo reconcilia las corridas colgadas: un deploy o un OOM a
 * mitad de un build deja una fila en `building` que nadie va a retomar, y sin esta
 * reconciliación bloquearía a esa estrategia para siempre (el scheduler no encola si ya
 * hay una pendiente).
 */

export default async function recommendationsBuildRunJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!recommendationsJobsEnabled()) return;

  // Dentro del cuerpo y no en scope de módulo: el archivo del job se evalúa al
  // arrancar, antes de que el loader de `app-settings` llene el snapshot, así que un
  // `const` acá arriba se quedaría con el valor del entorno para siempre. El
  // `schedule` de abajo no tiene esa salida —lo hornea el job loader— y por eso es
  // `envOnly` en el descriptor.
  const staleMinutes = getRecommendationsSettings().staleMinutes;

  const service = container.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  try {
    const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

    const building = (await service.listRecommendationVersions(
      { status: 'building' },
      { take: 20, order: { updated_at: 'ASC' } },
    )) as unknown as Array<VersionRow & { updated_at: string | Date }>;

    const stale = building.filter((version) => new Date(version.updated_at) < staleBefore);
    for (const version of stale) {
      await service.updateRecommendationVersions({
        id: version.id,
        status: 'failed',
        finished_at: new Date(),
        error_summary: {
          message: `Corrida abandonada: sin progreso por más de ${staleMinutes} minutos (probable deploy o reinicio del contenedor).`,
        },
      } as never);
      logger.warn(
        `[recommendations-build-run] corrida colgada de ${version.strategy_key} marcada como fallida`,
      );
    }

    // La más vieja que sigue viva. Una por tick.
    const next = building.find((version) => !stale.includes(version));
    if (!next) return;

    await runBuild(container, next);
  } catch (error) {
    // Nunca se propaga: un build roto no puede tumbar el scheduler.
    logger.error(
      `[recommendations-build-run] fallo: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const config = {
  name: 'recommendations-build-run',
  schedule: process.env.RECOMMENDATIONS_BUILD_CRON || '*/10 * * * *',
};
