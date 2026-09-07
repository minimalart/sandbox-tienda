import { MedusaError } from '@medusajs/framework/utils';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../../modules/recommendations';
import { mergeStrategyConfig } from '../../../../../modules/recommendations/config';
import { invalidateConfig } from '../../../../../modules/recommendations/serve/cache';
import type RecommendationEngineModuleService from '../../../../../modules/recommendations/service';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECOMMENDATION_STRATEGY_SITE_SCOPE } from '../../../../../modules/recommendations/site-scope';

const serviceOf = (req: MedusaRequest) =>
  req.scope.resolve(RECOMMENDATION_ENGINE_MODULE) as unknown as RecommendationEngineModuleService;

/** GET /admin/recommendations/strategies/:id */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECOMMENDATION_STRATEGY_SITE_SCOPE, req.params.id as string);

  const strategy = (await serviceOf(req).retrieveRecommendationStrategy(
    req.params.id as string,
  )) as unknown as Record<string, unknown>;
  res.status(200).json({
    strategy: { ...strategy, effective_config: mergeStrategyConfig(strategy.config) },
  });
}

/**
 * POST /admin/recommendations/strategies/:id — patch parcial.
 *
 * `config` se mergea sobre lo guardado antes de persistir: la pantalla de
 * Configuración manda sólo los campos que el usuario tocó y un reemplazo completo
 * borraría el resto.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECOMMENDATION_STRATEGY_SITE_SCOPE, req.params.id as string);

  const service = serviceOf(req);
  const id = req.params.id as string;
  const patch = req.validatedBody as Record<string, unknown>;

  const current = (await service.retrieveRecommendationStrategy(id)) as unknown as Record<
    string,
    unknown
  >;

  const nextConfig =
    patch.config === undefined
      ? undefined
      : {
          ...((current.config ?? {}) as Record<string, unknown>),
          ...(patch.config as Record<string, unknown>),
        };

  await service.updateRecommendationStrategies({
    id,
    ...patch,
    ...(nextConfig ? { config: nextConfig } : {}),
  } as never);

  invalidateConfig();
  const strategy = (await service.retrieveRecommendationStrategy(id)) as unknown as Record<
    string,
    unknown
  >;
  res.status(200).json({
    strategy: { ...strategy, effective_config: mergeStrategyConfig(strategy.config) },
  });
}

/**
 * DELETE /admin/recommendations/strategies/:id — soft delete.
 *
 * Se niega a borrar una estrategia referenciada por un placement o por la cadena de
 * fallback de otra: dejaría ese placement resolviendo a nada y el widget vacío sin
 * ninguna señal de por qué.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECOMMENDATION_STRATEGY_SITE_SCOPE, req.params.id as string);

  const service = serviceOf(req);
  const id = req.params.id as string;

  const strategy = (await service.retrieveRecommendationStrategy(id)) as unknown as {
    key: string;
  };

  const [placements, strategies] = await Promise.all([
    service.listRecommendationPlacements({}, { take: 200 }) as unknown as Promise<
      Array<{ key: string; strategy_key: string; fallback_chain: unknown }>
    >,
    service.listRecommendationStrategies({}, { take: 200 }) as unknown as Promise<
      Array<{ key: string; fallback_chain: unknown }>
    >,
  ]);

  const chainOf = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]) : []);

  const usedBy = [
    ...placements
      .filter((p) => p.strategy_key === strategy.key || chainOf(p.fallback_chain).includes(strategy.key))
      .map((p) => `placement "${p.key}"`),
    ...strategies
      .filter((s) => s.key !== strategy.key && chainOf(s.fallback_chain).includes(strategy.key))
      .map((s) => `estrategia "${s.key}"`),
  ];

  if (usedBy.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `No se puede eliminar la estrategia "${strategy.key}": la usan ${usedBy.join(', ')}. Quitala de ahí primero o desactivala.`,
    );
  }

  await service.softDeleteRecommendationStrategies([id]);
  invalidateConfig();
  res.status(200).json({ id, object: 'recommendation_strategy', deleted: true });
}
