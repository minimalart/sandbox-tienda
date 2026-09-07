import { MedusaError } from '@medusajs/framework/utils';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../../modules/recommendations';
import { invalidateConfig } from '../../../../../modules/recommendations/serve/cache';
import type RecommendationEngineModuleService from '../../../../../modules/recommendations/service';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECOMMENDATION_PLACEMENT_SITE_SCOPE } from '../../../../../modules/recommendations/site-scope';

const serviceOf = (req: MedusaRequest) =>
  req.scope.resolve(RECOMMENDATION_ENGINE_MODULE) as unknown as RecommendationEngineModuleService;

/** GET /admin/recommendations/placements/:id */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECOMMENDATION_PLACEMENT_SITE_SCOPE, req.params.id as string);

  const placement = await serviceOf(req).retrieveRecommendationPlacement(req.params.id as string);
  res.status(200).json({ placement });
}

/**
 * POST /admin/recommendations/placements/:id — patch parcial.
 *
 * Valida que la estrategia y la cadena referencien keys existentes. Sin este
 * chequeo, un typo deja el placement resolviendo a nada y el síntoma es un widget
 * vacío en el storefront, que es de las cosas más difíciles de diagnosticar desde el
 * backoffice.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECOMMENDATION_PLACEMENT_SITE_SCOPE, req.params.id as string);

  const service = serviceOf(req);
  const id = req.params.id as string;
  const patch = req.validatedBody as Record<string, unknown>;

  const referenced = [
    ...(typeof patch.strategy_key === 'string' ? [patch.strategy_key] : []),
    ...(Array.isArray(patch.fallback_chain) ? (patch.fallback_chain as string[]) : []),
  ];

  if (referenced.length) {
    const strategies = (await service.listRecommendationStrategies({}, { take: 200 })) as unknown as Array<{
      key: string;
    }>;
    const known = new Set(strategies.map((s) => s.key));
    const unknown = [...new Set(referenced)].filter((key) => !known.has(key));
    if (unknown.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Estrategias inexistentes: ${unknown.join(', ')}.`,
      );
    }
  }

  await service.updateRecommendationPlacements({ id, ...patch } as never);
  invalidateConfig();
  const placement = await service.retrieveRecommendationPlacement(id);
  res.status(200).json({ placement });
}
