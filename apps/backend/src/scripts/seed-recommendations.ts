import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ensureRecommendationDefaults } from '../modules/recommendations/seed/defaults';

/**
 * Siembra las estrategias y placements por defecto del motor de recomendaciones.
 *
 *   npx medusa exec ./src/scripts/seed-recommendations.ts   (o `pnpm seed:recommendations`)
 *
 * Idempotente: crea sólo lo que falta y nunca sobrescribe la configuración que el
 * merchant ya ajustó. Los seeds NO se aplican automáticamente en el deploy — hay
 * que correrlo una vez por entorno.
 *
 * En producción conviene usar `POST /admin/recommendations/seed`, que llama a la
 * misma función: `medusa exec` en la consola de DigitalOcean bootea un segundo
 * Medusa dentro del contenedor y se queda sin memoria (503).
 */
export default async function seedRecommendations({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const result = await ensureRecommendationDefaults(container);

  logger.info(
    `[seed-recommendations] Estrategias creadas: ${result.strategies_created} · Placements creados: ${result.placements_created}`,
  );
  if (result.strategies_created === 0 && result.placements_created === 0) {
    logger.info('[seed-recommendations] Todo estaba sembrado — no se cambió nada.');
  }
}
