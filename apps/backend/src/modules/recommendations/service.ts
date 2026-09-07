import { MedusaService } from '@medusajs/framework/utils';
import {
  RecommendationEvent,
  RecommendationMetric,
  RecommendationPlacement,
  RecommendationRelation,
  RecommendationStrategy,
  RecommendationVersion,
} from './models';

/**
 * RecommendationEngineModuleService — CRUD generado por MedusaService sobre los 6
 * modelos, más el acceso a knex para las queries que no se pueden expresar con el
 * repositorio (candidatos con window functions, co-ocurrencia, rollups,
 * delete-then-insert, purga por lotes).
 *
 * El acceso a knex sigue el mismo patrón que `commerce-dashboard/service.ts`.
 * Cuidado: en SQL crudo el soft-delete NO es automático — hay que agregar
 * `whereNull('deleted_at')` / `AND deleted_at IS NULL` a mano en cada query.
 */
class RecommendationEngineModuleService extends MedusaService({
  RecommendationRelation,
  RecommendationStrategy,
  RecommendationPlacement,
  RecommendationVersion,
  RecommendationEvent,
  RecommendationMetric,
}) {
  protected get knex() {
    return (this as any).__container__.manager.getKnex();
  }

  /**
   * Crea la estrategia si su `key` no existe; si existe, NO la toca.
   *
   * Es lo que hace idempotente al seed y le permite correrse en cada entorno sin
   * pisar la configuración que el merchant ya ajustó desde el backoffice.
   */
  async ensureStrategy(input: {
    key: string;
    name: string;
    kind: string;
    enabled?: boolean;
    cadence?: string;
    config?: Record<string, unknown>;
    fallback_chain?: string[];
    sort_order?: number;
  }): Promise<{ created: boolean }> {
    const [existing] = await this.listRecommendationStrategies({ key: input.key }, { take: 1 });
    if (existing) return { created: false };
    await this.createRecommendationStrategies(input as any);
    return { created: true };
  }

  /** Idem para placements: crea si falta, nunca sobrescribe. */
  async ensurePlacement(input: {
    key: string;
    name: string;
    strategy_key: string;
    enabled?: boolean;
    result_limit?: number;
    candidate_limit?: number;
    filters?: Record<string, unknown>;
    relation_types?: string[];
    fallback_chain?: string[];
    sort_order?: number;
  }): Promise<{ created: boolean }> {
    const [existing] = await this.listRecommendationPlacements({ key: input.key }, { take: 1 });
    if (existing) return { created: false };
    await this.createRecommendationPlacements(input as any);
    return { created: true };
  }
}

export default RecommendationEngineModuleService;
