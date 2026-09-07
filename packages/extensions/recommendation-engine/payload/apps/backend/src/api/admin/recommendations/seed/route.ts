import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ensureRecommendationDefaults } from '../../../../modules/recommendations/seed/defaults';
import { invalidateConfig } from '../../../../modules/recommendations/serve/cache';

/**
 * POST /admin/recommendations/seed — siembra estrategias y placements por defecto.
 *
 * Existe además del script `pnpm seed:recommendations` porque `medusa exec` en la
 * consola de DigitalOcean bootea un segundo Medusa dentro del contenedor y se queda
 * sin memoria (503). Ambos caminos llaman a la misma función y son idempotentes: no
 * sobrescriben nada de lo que el merchant ya haya configurado.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const result = await ensureRecommendationDefaults(req.scope);
  invalidateConfig();
  res.status(200).json(result);
}
