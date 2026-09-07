import type { MedusaContainer } from '@medusajs/framework/types';
import { RECOMMENDATION_ENGINE_MODULE } from '..';
import { DEFAULT_CADENCE_BY_KIND } from '../config';
import type RecommendationEngineModuleService from '../service';

/**
 * Estrategias y placements por defecto (PRD §11.2/§11.3).
 *
 * Dos criterios que conviene no romper:
 *
 * 1. TODAS las cadenas de fallback terminan en `popular`. Sin eso, una tienda
 *    nueva —sin órdenes para co-compra y sin relaciones manuales cargadas— vería
 *    widgets vacíos el día 1, que es justo lo que el PRD §7 quiere evitar. El
 *    fallback es comportamiento normal, no una degradación.
 *
 * 2. `config` se siembra en NULL, no con los defaults copiados. Los mínimos
 *    estadísticos viven en `STRATEGY_CONFIG_DEFAULTS` (config.ts) y el merge los
 *    aplica al leer, así que hay una sola fuente de verdad: si mañana subimos un
 *    default, los entornos ya sembrados lo toman. El backoffice muestra los
 *    valores efectivos (mergeados) y sólo persiste lo que el merchant cambia.
 */
type StrategySeed = {
  key: string;
  name: string;
  kind: 'manual' | 'similar' | 'frequently_bought_together' | 'trending' | 'popular';
  fallback_chain: string[];
  sort_order: number;
};

export const DEFAULT_STRATEGIES: StrategySeed[] = [
  {
    key: 'manual',
    name: 'Relaciones manuales',
    kind: 'manual',
    fallback_chain: ['similar', 'popular'],
    sort_order: 10,
  },
  {
    key: 'similar',
    name: 'Productos similares',
    kind: 'similar',
    fallback_chain: ['popular'],
    sort_order: 20,
  },
  {
    key: 'frequently_bought_together',
    name: 'Comprados juntos',
    kind: 'frequently_bought_together',
    // La cadena del ejemplo del PRD §7: co-compra → manuales → similares →
    // populares.
    fallback_chain: ['manual', 'similar', 'popular'],
    sort_order: 30,
  },
  {
    key: 'trending',
    name: 'En tendencia',
    kind: 'trending',
    fallback_chain: ['popular'],
    sort_order: 40,
  },
  {
    key: 'popular',
    name: 'Más vendidos',
    kind: 'popular',
    // Terminal: es el último recurso de toda cadena, no puede tener fallback.
    fallback_chain: [],
    sort_order: 50,
  },
];

type PlacementSeed = {
  key: string;
  name: string;
  strategy_key: string;
  result_limit: number;
  candidate_limit?: number;
  relation_types?: string[];
  fallback_chain?: string[];
  sort_order: number;
};

export const DEFAULT_PLACEMENTS: PlacementSeed[] = [
  {
    key: 'product-detail-similar',
    name: 'Ficha de producto — Similares',
    strategy_key: 'similar',
    result_limit: 8,
    relation_types: ['similar', 'alternative', 'upgrade'],
    sort_order: 10,
  },
  {
    key: 'product-detail-complementary',
    name: 'Ficha de producto — Complementarios',
    // Arranca en manuales: los complementarios buenos los sabe el merchant mucho
    // antes de que haya órdenes suficientes para inferirlos.
    strategy_key: 'manual',
    result_limit: 8,
    relation_types: ['complementary', 'accessory', 'replacement'],
    fallback_chain: ['frequently_bought_together', 'similar', 'popular'],
    sort_order: 20,
  },
  {
    key: 'product-detail-fbt',
    name: 'Ficha de producto — Comprados juntos',
    strategy_key: 'frequently_bought_together',
    // Bloque chico a propósito: el widget muestra el producto actual + los
    // acompañantes con checkbox, y con más de 3 deja de ser accionable.
    result_limit: 3,
    relation_types: ['bought_together', 'complementary', 'accessory'],
    sort_order: 30,
  },
  {
    key: 'cart-recommendations',
    name: 'Carrito — Recomendados',
    strategy_key: 'frequently_bought_together',
    result_limit: 8,
    sort_order: 40,
  },
  {
    key: 'free-shipping-bridge',
    name: 'Carrito — Productos puente (envío gratis)',
    // Sin producto de origen: los candidatos vienen del set global de populares y
    // se filtran por la banda de precio del monto faltante, así que hace falta
    // leer muchos más candidatos que el límite.
    strategy_key: 'popular',
    result_limit: 4,
    candidate_limit: 120,
    fallback_chain: ['trending'],
    sort_order: 50,
  },
  {
    key: 'recently-viewed',
    name: 'Vistos recientemente',
    // No consulta relaciones: los candidatos los manda el storefront en
    // `context.product_ids` (localStorage). El motor sólo aplica los filtros
    // operativos y arma la respuesta.
    strategy_key: 'manual',
    result_limit: 12,
    sort_order: 60,
  },
];

export type SeedResult = {
  strategies_created: number;
  placements_created: number;
};

/**
 * Siembra estrategias y placements por defecto. Idempotente: crea sólo lo que
 * falta y nunca sobrescribe lo que ya existe.
 *
 * Se expone por dos caminos porque `medusa exec` OOMea en la consola de DO
 * (bootea un segundo Medusa dentro del contenedor y se queda sin memoria):
 * `pnpm seed:recommendations` en local/CI y `POST /admin/recommendations/seed`
 * en producción. Ambos llaman a esta misma función.
 */
export async function ensureRecommendationDefaults(
  container: MedusaContainer,
): Promise<SeedResult> {
  const service = container.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  let strategiesCreated = 0;
  for (const strategy of DEFAULT_STRATEGIES) {
    const { created } = await service.ensureStrategy({
      key: strategy.key,
      name: strategy.name,
      kind: strategy.kind,
      enabled: true,
      cadence: DEFAULT_CADENCE_BY_KIND[strategy.kind],
      fallback_chain: strategy.fallback_chain,
      sort_order: strategy.sort_order,
    });
    if (created) strategiesCreated++;
  }

  let placementsCreated = 0;
  for (const placement of DEFAULT_PLACEMENTS) {
    const { created } = await service.ensurePlacement({
      key: placement.key,
      name: placement.name,
      strategy_key: placement.strategy_key,
      enabled: true,
      result_limit: placement.result_limit,
      ...(placement.candidate_limit ? { candidate_limit: placement.candidate_limit } : {}),
      ...(placement.relation_types ? { relation_types: placement.relation_types } : {}),
      ...(placement.fallback_chain ? { fallback_chain: placement.fallback_chain } : {}),
      sort_order: placement.sort_order,
    });
    if (created) placementsCreated++;
  }

  return { strategies_created: strategiesCreated, placements_created: placementsCreated };
}
