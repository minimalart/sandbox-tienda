import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { enqueueDueBuilds } from '../../../../modules/recommendations/recompute/schedule';

/**
 * POST /admin/recommendations/rebuild — encola un recálculo.
 *
 * Devuelve **202** y NO ejecuta el build dentro del request. Un recálculo de co-compra
 * o de similares puede tardar minutos y ocupar el vCPU: hacerlo acá colgaría el
 * request, arriesgaría el timeout del proxy y competiría con el HTTP server. El drainer
 * (`recommendations-build-run`) lo levanta en el próximo tick.
 *
 * Body opcional `{ strategy_key }` para una sola estrategia; sin él, encola todas las
 * que correspondan. Es idempotente: si ya hay una corrida pendiente, la informa como
 * salteada en lugar de encolar otra.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = (req.body ?? {}) as { strategy_key?: string };

  const result = await enqueueDueBuilds(req.scope, {
    only_strategy_key: typeof body.strategy_key === 'string' ? body.strategy_key : undefined,
    triggered_by: 'manual',
  });

  res.status(202).json(result);
}
