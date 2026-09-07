import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../modules/recommendations';
import { getRecommendationsConfig } from '../../../../modules/recommendations/config';
import { buildChain } from '../../../../modules/recommendations/serve/resolve';
import type RecommendationEngineModuleService from '../../../../modules/recommendations/service';

/**
 * GET /admin/recommendations/placements — placements con su cadena EFECTIVA.
 *
 * `effective_chain` es la cadena que realmente va a recorrer el motor: resuelta con
 * la misma función que usa el serve (`buildChain`), así que ya tiene aplicados el
 * override del placement, el descarte de estrategias deshabilitadas y el recorte a
 * `max_chain_length`. Es lo que hace que el backoffice muestre el comportamiento
 * real y no la configuración cruda — mirar `fallback_chain` a secas no dice qué va a
 * pasar si un eslabón está apagado.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  // El placement es por canal. Sin filtrar, el backoffice muestra la cadena efectiva
  // de otra tienda como si fuera la propia — y la cadena efectiva es justamente lo
  // que se mira para diagnosticar.
  const placementFilter = siteChannelFilter(await siteFromRequest(req), undefined);

  const [config, placements, strategies] = await Promise.all([
    getRecommendationsConfig(req.scope),
    service.listRecommendationPlacements(
      placementFilter,
      { take: 200, order: { sort_order: 'ASC', created_at: 'ASC' } },
    ) as unknown as Promise<Array<Record<string, unknown>>>,
    service.listRecommendationStrategies({}, { take: 200 }) as unknown as Promise<
      Array<Record<string, unknown>>
    >,
  ]);

  const registry = new Map(strategies.map((s) => [s.key as string, s as never]));

  res.status(200).json({
    placements: placements.map((placement) => ({
      ...placement,
      effective_chain: buildChain(
        {
          strategy_key: placement.strategy_key as string,
          fallback_chain: placement.fallback_chain,
        },
        registry,
        config.max_chain_length,
      ),
    })),
    count: placements.length,
  });
}
