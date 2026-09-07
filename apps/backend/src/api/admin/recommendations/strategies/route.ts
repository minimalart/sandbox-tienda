import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../modules/recommendations';
import { mergeStrategyConfig } from '../../../../modules/recommendations/config';
import type RecommendationEngineModuleService from '../../../../modules/recommendations/service';

import { siteFromRequest } from '../../../../lib/multistore/request';

/**
 * GET /admin/recommendations/strategies — estrategias con su config EFECTIVA.
 *
 * `effective_config` es el merge sobre defaults; `config` es sólo lo persistido. El
 * backoffice muestra el efectivo y guarda únicamente lo que el merchant cambia, así
 * los defaults siguen siendo una sola fuente de verdad (config.ts) y una mejora de
 * default llega a los entornos ya sembrados.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  /**
   * `sales_channel_id NULL` = estrategia GLOBAL, no huérfana: se aplica en todas las
   * tiendas. Por eso el listado incluye las globales además de las de la tienda — si
   * las escondiera, el operador vería una cadena efectiva con eslabones que no
   * aparecen en ninguna lista.
   */
  const strategyResolution = await siteFromRequest(req);
  const strategyChannels =
    strategyResolution.status === 'site' ? strategyResolution.site.channel_ids : [];

  const strategies = (await service.listRecommendationStrategies(
    strategyChannels.length ? { sales_channel_id: [...strategyChannels, null] } : {},
    { take: 200, order: { sort_order: 'ASC', created_at: 'ASC' } },
  )) as unknown as Array<Record<string, unknown>>;

  res.status(200).json({
    strategies: strategies.map((strategy) => ({
      ...strategy,
      effective_config: mergeStrategyConfig(strategy.config),
    })),
    count: strategies.length,
  });
}
