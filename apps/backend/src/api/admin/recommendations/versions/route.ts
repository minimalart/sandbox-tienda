import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../modules/recommendations';
import type RecommendationEngineModuleService from '../../../../modules/recommendations/service';

/**
 * GET /admin/recommendations/versions — log de corridas (PRD §20).
 *
 * La fila de versión ES el log: estrategia, inicio, fin, duración, estado, órdenes
 * analizadas, relaciones generadas y descartadas, y el error si hubo. Es la pantalla
 * donde se diagnostica "por qué no hay recomendaciones automáticas": lo más común es
 * una corrida en `ready` sin activar por no llegar al mínimo de órdenes.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  const limit = Number(req.query.limit ?? 30);
  const strategyKey = typeof req.query.strategy_key === 'string' ? req.query.strategy_key : undefined;

  // Las corridas son POR CANAL: sin filtrar, el diagnóstico de "por qué no hay
  // recomendaciones" mezcla las de todas las tiendas y no se entiende nada.
  const siteFilterForVersions = siteChannelFilter(await siteFromRequest(req), undefined);

  const [versions, count] = (await service.listAndCountRecommendationVersions(
    { ...(strategyKey ? { strategy_key: strategyKey } : {}), ...siteFilterForVersions },
    { take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 30, order: { created_at: 'DESC' } },
  )) as unknown as [Array<Record<string, unknown>>, number];

  res.status(200).json({ versions, count });
}
