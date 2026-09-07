import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { RECOMMENDATION_ENGINE_MODULE } from '..';
import {
  getRecommendationsConfig,
  recommendationsEnvEnabled,
  RECOMMENDATIONS_HARD_CAPS,
  type RecommendationsConfig,
} from '../config';
import { GLOBAL_SOURCE_PRODUCT_ID } from '../models';
import type RecommendationEngineModuleService from '../service';
import type {
  Candidate,
  DiscardReason,
  EligibilityContext,
  HydratedProduct,
  PlacementFilters,
  ResolvedTier,
  ScoredCandidate,
  ServeInput,
} from '../types';
import { bridgeBand, selectBridgeProducts } from './bridge';
import { CACHE_KEYS, memo } from './cache';
import { loadCandidates, type CandidateTier } from './candidates';
import { applyEligibilityFilters, referencePrice } from './filters';
import { hydrateProducts } from './hydrate';
import { rankCandidates, resolveChain } from './ranking';
import { mintRequestId, resolveEventSecret } from './request-token';

/**
 * Orquestador del serve path (PRD §15.1).
 *
 * Presupuesto: TRES round trips fijos, independientes del límite pedido, del
 * candidate_limit y del largo de la cadena de fallbacks.
 *
 *   1. candidatos de toda la cadena (una query con window function)
 *   2. carrito o región (para el contexto de precio y las exclusiones)
 *   3. hidratación batch de la unión de candidatos + el producto de origen
 *
 * Config, placements, estrategias y versiones activas salen del memo en proceso, así
 * que no cuestan round trip. Filtrado y ranking son JS puro sobre un set acotado.
 */

export type ServeProduct = {
  product_id: string;
  title: string | null;
  handle: string | null;
  thumbnail: string | null;
  position: number;
  score: number;
  relation_type: string;
  strategy_key: string;
  price: number | null;
  currency_code: string | null;
  reason: { confidence: number | null; co_occurrences: number | null } | null;
  variants: Array<{
    id: string;
    sku: string | null;
    title: string | null;
    calculated_amount: number | null;
    original_amount: number | null;
    currency_code: string | null;
    available: number;
  }>;
};

export type ServeResult = {
  request_id: string;
  placement: string;
  strategy_key: string | null;
  resolved_strategy_key: string | null;
  fallback_used: boolean;
  fallback_chain: string[];
  version_id: string | null;
  limit: number;
  count: number;
  products: ServeProduct[];
  /** Contexto resuelto, que la fila `served` persiste (PR 4). */
  served_context: {
    source_product_id: string | null;
    cart_id: string | null;
    customer_id: string | null;
    session_id: string | null;
    sales_channel_id: string | null;
    region_id: string | null;
    currency_code: string | null;
  };
  debug?: {
    candidates_loaded: number;
    tiers: Array<{ strategy_key: string; candidates: number; eligible: number }>;
    discarded: Partial<Record<DiscardReason, number>>;
  };
};

const EMPTY_RESULT = (placement: string, requestId: string): ServeResult => ({
  request_id: requestId,
  placement,
  strategy_key: null,
  resolved_strategy_key: null,
  fallback_used: false,
  fallback_chain: [],
  version_id: null,
  limit: 0,
  count: 0,
  products: [],
  served_context: {
    source_product_id: null,
    cart_id: null,
    customer_id: null,
    session_id: null,
    sales_channel_id: null,
    region_id: null,
    currency_code: null,
  },
});

type PlacementRow = {
  key: string;
  enabled: boolean;
  strategy_key: string;
  fallback_chain: unknown;
  result_limit: number;
  candidate_limit: number;
  filters: unknown;
  relation_types: unknown;
  sales_channel_id: string | null;
};

type StrategyRow = {
  key: string;
  kind: string;
  enabled: boolean;
  fallback_chain: unknown;
  config: unknown;
  sales_channel_id: string | null;
};

type ActiveVersionRow = { strategy_key: string; sales_channel_id: string | null; id: string };

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : [];

/**
 * Cadena efectiva: override del placement, si no la de la estrategia, y siempre
 * arrancando por la estrategia del placement.
 *
 * Se deduplica, se saltean las estrategias deshabilitadas o inexistentes y se
 * recorta a `max_chain_length`. Una cadena con la misma estrategia dos veces haría
 * el mismo trabajo dos veces y gastaría un eslabón del presupuesto.
 */
export function buildChain(
  placement: Pick<PlacementRow, 'strategy_key' | 'fallback_chain'>,
  strategies: Map<string, StrategyRow>,
  maxLength: number,
): string[] {
  const strategy = strategies.get(placement.strategy_key);
  const configured = asStringArray(placement.fallback_chain).length
    ? asStringArray(placement.fallback_chain)
    : asStringArray(strategy?.fallback_chain);

  const chain: string[] = [];
  for (const key of [placement.strategy_key, ...configured]) {
    if (chain.length >= maxLength) break;
    if (chain.includes(key)) continue;
    const candidateStrategy = strategies.get(key);
    if (!candidateStrategy || !candidateStrategy.enabled) continue;
    chain.push(key);
  }
  return chain;
}

/** Lee configuración, placements y estrategias, todo memoizado. */
async function loadConfiguration(container: MedusaContainer) {
  const service = container.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  const [config, placements, strategies] = await Promise.all([
    memo<RecommendationsConfig>(CACHE_KEYS.config, () => getRecommendationsConfig(container)),
    memo<PlacementRow[]>(CACHE_KEYS.placements, async () =>
      (await service.listRecommendationPlacements({}, { take: 200 })) as unknown as PlacementRow[],
    ),
    memo<StrategyRow[]>(CACHE_KEYS.strategies, async () =>
      (await service.listRecommendationStrategies({}, { take: 200 })) as unknown as StrategyRow[],
    ),
  ]);

  return {
    service,
    config,
    placements: new Map(placements.map((p) => [p.key, p])),
    strategies: new Map(strategies.map((s) => [s.key, s])),
  };
}

/** Mapa `strategy_key|canal` → id de versión activa. */
async function loadActiveVersions(
  service: RecommendationEngineModuleService,
): Promise<Map<string, string>> {
  return memo(CACHE_KEYS.activeVersions, async () => {
    const rows = (await service.listRecommendationVersions(
      { status: 'active' },
      { take: 500 },
    )) as unknown as ActiveVersionRow[];
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(`${row.strategy_key}|${row.sales_channel_id ?? ''}`, row.id);
    }
    return map;
  });
}

/**
 * Versión activa de una estrategia para el canal pedido, con fallback a la global.
 * Una versión por canal gana sobre la global: es lo que permite tener recomendaciones
 * distintas por demo/canal sin duplicar la estrategia.
 */
const activeVersionFor = (
  versions: Map<string, string>,
  strategyKey: string,
  salesChannelId: string | null,
): string | null =>
  (salesChannelId ? versions.get(`${strategyKey}|${salesChannelId}`) : undefined) ??
  versions.get(`${strategyKey}|`) ??
  null;

type PriceContext = {
  currency_code: string;
  region_id: string | null;
  sales_channel_id: string | null;
  cart_product_ids: Set<string>;
};

/**
 * Resuelve moneda, región, canal y contenido del carrito.
 *
 * Con `cart_id` sale todo de una sola consulta al carrito (que además es la fuente
 * más confiable: es el contexto real de la compra). Sin carrito, si vino `region_id`
 * se consulta la región para saber la moneda — sin moneda las variantes no traen
 * `calculated_price` y TODO se descartaría por `no_price`.
 */
async function resolvePriceContext(
  query: { graph: (config: Record<string, unknown>) => Promise<{ data: unknown[] }> },
  input: ServeInput,
): Promise<PriceContext> {
  const cartProductIds = new Set<string>();
  let currency = input.context?.currency_code?.toLowerCase() ?? null;
  let regionId = input.region_id ?? null;
  let salesChannelId = input.sales_channel_id ?? null;

  if (input.cart_id) {
    const { data } = await query.graph({
      entity: 'cart',
      fields: ['id', 'currency_code', 'region_id', 'sales_channel_id', 'items.product_id'],
      filters: { id: input.cart_id },
    });
    const cart = data[0] as
      | {
          currency_code?: string | null;
          region_id?: string | null;
          sales_channel_id?: string | null;
          items?: Array<{ product_id?: string | null }> | null;
        }
      | undefined;
    if (cart) {
      currency = currency ?? cart.currency_code?.toLowerCase() ?? null;
      regionId = regionId ?? cart.region_id ?? null;
      salesChannelId = salesChannelId ?? cart.sales_channel_id ?? null;
      for (const item of cart.items ?? []) {
        if (item?.product_id) cartProductIds.add(item.product_id);
      }
    }
  } else if (!currency && regionId) {
    const { data } = await query.graph({
      entity: 'region',
      fields: ['id', 'currency_code'],
      filters: { id: regionId },
    });
    const region = data[0] as { currency_code?: string | null } | undefined;
    currency = region?.currency_code?.toLowerCase() ?? null;
  }

  return {
    // Último recurso: sin moneda no hay precios y la respuesta saldría vacía. `ars`
    // es la moneda por defecto del boilerplate (mismo fallback que shop-by-look).
    currency_code: currency ?? 'ars',
    region_id: regionId,
    sales_channel_id: salesChannelId,
    cart_product_ids: cartProductIds,
  };
}

const toServeProduct = (item: ScoredCandidate, index: number): ServeProduct => {
  const price = referencePrice(item.product);
  const currency =
    item.product.variants.find((v) => v.currency_code)?.currency_code ?? null;
  return {
    product_id: item.product.id,
    title: item.product.title,
    handle: item.product.handle,
    thumbnail: item.product.thumbnail,
    position: index,
    score: item.candidate.score,
    relation_type: item.candidate.relation_type,
    strategy_key: item.candidate.strategy_key,
    price,
    currency_code: currency,
    reason:
      item.candidate.confidence !== null || item.candidate.co_occurrences !== null
        ? { confidence: item.candidate.confidence, co_occurrences: item.candidate.co_occurrences }
        : null,
    variants: item.product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      calculated_amount: v.calculated_amount,
      original_amount: v.original_amount,
      currency_code: v.currency_code,
      // Se normaliza Infinity (stock ilimitado) a un entero grande: Infinity no es
      // JSON válido y `JSON.stringify` lo emitiría como null.
      available: Number.isFinite(v.available) ? v.available : 999_999,
    })),
  };
};

/**
 * Los dos placements con forma propia de entrada. Se exportan porque quien ARMA la
 * entrada (el storefront, y el preview del backoffice) necesita saber que uno espera
 * `context.target_price` y el otro `context.product_ids`: sin eso, previsualizar
 * "vistos recientemente" mandando el producto como origen devolvería siempre cero
 * (el filtro `source` descarta al propio producto de origen).
 */
export const BRIDGE_PLACEMENT = 'free-shipping-bridge';
export const RECENTLY_VIEWED_PLACEMENT = 'recently-viewed';

/**
 * Resuelve las recomendaciones de un placement.
 *
 * Nunca lanza por falta de datos: un placement desconocido o deshabilitado, una
 * cadena sin estrategias habilitadas o cero candidatos devuelven una respuesta
 * vacía bien formada. Una recomendación es decoración: no puede tumbar una PDP.
 */
export async function resolveRecommendations(
  container: MedusaContainer,
  input: ServeInput,
): Promise<ServeResult> {
  const secret = resolveEventSecret();
  const requestId = mintRequestId(secret ?? 'unsigned');

  // Kill switch de proceso: antes de tocar la base, para que sirva incluso cuando
  // la base es el problema.
  if (!recommendationsEnvEnabled()) return EMPTY_RESULT(input.placement, requestId);

  const { service, config, placements, strategies } = await loadConfiguration(container);
  if (!config.enabled) return EMPTY_RESULT(input.placement, requestId);

  const placement = placements.get(input.placement);
  if (!placement || !placement.enabled) return EMPTY_RESULT(input.placement, requestId);

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const priceContext = await resolvePriceContext(query as never, input);

  // Un placement acotado a un canal no responde en otro.
  if (placement.sales_channel_id && placement.sales_channel_id !== priceContext.sales_channel_id) {
    return EMPTY_RESULT(input.placement, requestId);
  }

  const isBridge = placement.key === BRIDGE_PLACEMENT;
  const isRecentlyViewed = placement.key === RECENTLY_VIEWED_PLACEMENT;

  const limit = Math.min(
    Math.max(1, input.limit ?? placement.result_limit ?? config.default_result_limit),
    RECOMMENDATIONS_HARD_CAPS.result_limit,
  );
  const candidateLimit = Math.min(
    Math.max(limit, placement.candidate_limit ?? config.default_candidate_limit),
    isBridge
      ? RECOMMENDATIONS_HARD_CAPS.bridge_candidate_limit
      : RECOMMENDATIONS_HARD_CAPS.candidate_limit,
  );

  const chain = buildChain(placement, strategies, config.max_chain_length);
  const versions = await loadActiveVersions(service);

  // --- Candidatos ----------------------------------------------------------

  let candidates: Candidate[] = [];
  if (isRecentlyViewed) {
    // Vistos recientemente no consulta relaciones: los candidatos los manda el
    // storefront desde localStorage, en el orden en que los vio el usuario. El
    // motor sólo aplica los filtros operativos.
    const provided = asStringArray(input.context?.product_ids).slice(0, candidateLimit);
    candidates = provided.map((productId, index) => ({
      target_product_id: productId,
      strategy_key: placement.strategy_key,
      relation_type: 'viewed_together',
      // El orden lo fija el cliente: prioridad decreciente preserva su secuencia.
      priority: provided.length - index,
      score: 0,
      confidence: null,
      co_occurrences: null,
      version_id: null,
    }));
  } else {
    const tiers: CandidateTier[] = [];
    for (const key of chain) {
      const strategy = strategies.get(key);
      if (!strategy) continue;
      const isManual = strategy.kind === 'manual';
      if (isManual) {
        tiers.push({ strategy_key: key, version_id: null, is_manual: true });
        continue;
      }
      const versionId = activeVersionFor(versions, key, priceContext.sales_channel_id);
      // Estrategia automática sin versión activa: todavía no se calculó nada, así
      // que no puede aportar candidatos. Se saltea en lugar de traer vacío.
      if (!versionId) continue;
      tiers.push({ strategy_key: key, version_id: versionId, is_manual: false });
    }

    if (tiers.length) {
      // Las estrategias sin origen (trending, popular y por lo tanto bridge) viven
      // bajo el sentinela global; las que sí tienen origen, bajo el product_id.
      const sources = new Set<string>();
      if (input.product_id) sources.add(input.product_id);
      const needsGlobal = tiers.some((tier) => {
        const kind = strategies.get(tier.strategy_key)?.kind;
        return kind === 'trending' || kind === 'popular';
      });
      if (needsGlobal || !input.product_id) sources.add(GLOBAL_SOURCE_PRODUCT_ID);

      const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as never;
      candidates = await loadCandidates(knex, {
        sources: [...sources],
        tiers,
        relation_types: asStringArray(placement.relation_types),
        sales_channel_id: priceContext.sales_channel_id,
        candidate_limit: candidateLimit,
      });
    }
  }

  if (!candidates.length) {
    return {
      ...EMPTY_RESULT(input.placement, requestId),
      strategy_key: placement.strategy_key,
      fallback_chain: chain,
      limit,
      served_context: {
        source_product_id: input.product_id ?? null,
        cart_id: input.cart_id ?? null,
        customer_id: input.customer_id ?? null,
        session_id: input.session_id ?? null,
        sales_channel_id: priceContext.sales_channel_id,
        region_id: priceContext.region_id,
        currency_code: priceContext.currency_code,
      },
    };
  }

  // --- Hidratación ---------------------------------------------------------

  const productIds = candidates.map((c) => c.target_product_id);
  if (input.product_id) productIds.push(input.product_id);

  const hydrated = await hydrateProducts(query as never, QueryContext, {
    product_ids: productIds,
    currency_code: priceContext.currency_code,
    region_id: priceContext.region_id,
  });

  const sourceProduct: HydratedProduct | null = input.product_id
    ? hydrated.get(input.product_id) ?? null
    : null;

  // --- Filtros y ranking por eslabón --------------------------------------

  const placementFilters = ((placement.filters ?? {}) as PlacementFilters) || {};
  const filters: PlacementFilters = { ...placementFilters };

  // Bridge: la banda de precio del monto faltante se suma a los filtros del
  // placement. Si el cliente manda la banda ya calculada se respeta; si sólo manda
  // el faltante, se deriva con los factores de configuración.
  let band: ReturnType<typeof bridgeBand> | null = null;
  if (isBridge) {
    const target = Number(input.context?.target_price ?? 0);
    if (!Number.isFinite(target) || target <= 0) {
      // Sin monto faltante no hay nada que puentear (o el envío ya es gratis).
      return {
        ...EMPTY_RESULT(input.placement, requestId),
        strategy_key: placement.strategy_key,
        fallback_chain: chain,
        limit,
      };
    }
    band = bridgeBand(target, {
      lower: config.free_shipping.bridge_lower_factor,
      upper: config.free_shipping.bridge_upper_factor,
    });
    filters.price_min = Number(input.context?.price_min ?? band.price_min);
    filters.price_max = Number(input.context?.price_max ?? band.price_max);
  }

  const eligibility: EligibilityContext = {
    source_product_id: input.product_id ?? null,
    source_product: sourceProduct,
    cart_product_ids: priceContext.cart_product_ids,
    exclude_product_ids: new Set(asStringArray(input.context?.exclude_product_ids)),
    sales_channel_id: priceContext.sales_channel_id,
  };

  const tierOrder = isRecentlyViewed ? [placement.strategy_key] : chain;
  const resolvedTiers: ResolvedTier[] = [];
  const discardTotals: Partial<Record<DiscardReason, number>> = {};
  const debugTiers: Array<{ strategy_key: string; candidates: number; eligible: number }> = [];

  for (const strategyKey of tierOrder) {
    const tierCandidates = candidates.filter((c) => c.strategy_key === strategyKey);
    if (!tierCandidates.length) {
      // Se empuja el eslabón VACÍO igual, no se saltea: `resolveChain` usa la
      // posición en el arreglo para decidir `fallback_used`, así que omitir los
      // eslabones sin candidatos haría que responder desde el segundo eslabón se
      // reportara como "sin fallback" y arruinaría la métrica de uso de fallbacks.
      resolvedTiers.push({ strategy_key: strategyKey, kept: [] });
      debugTiers.push({ strategy_key: strategyKey, candidates: 0, eligible: 0 });
      continue;
    }
    // Rankear ANTES de filtrar: así el orden lo decide el criterio de negocio y el
    // filtro sólo saca, nunca reordena (y el dedupe conserva la mejor relación).
    const ranked = rankCandidates(
      tierCandidates.map((candidate) => ({
        candidate,
        product: hydrated.get(candidate.target_product_id) as HydratedProduct,
      })),
    );
    const outcome = applyEligibilityFilters(
      ranked.map((item) => ({
        candidate: item.candidate,
        product: hydrated.get(item.candidate.target_product_id),
      })),
      eligibility,
      filters,
    );
    for (const [reason, count] of Object.entries(outcome.discarded)) {
      const key = reason as DiscardReason;
      discardTotals[key] = (discardTotals[key] ?? 0) + (count ?? 0);
    }
    resolvedTiers.push({ strategy_key: strategyKey, kept: outcome.kept });
    debugTiers.push({
      strategy_key: strategyKey,
      candidates: tierCandidates.length,
      eligible: outcome.kept.length,
    });
  }

  const resolution = resolveChain(resolvedTiers, { limit, minResults: config.min_results });

  // Bridge reordena por utilidad para cerrar el envío gratis, no por relevancia.
  const items =
    isBridge && band
      ? selectBridgeProducts(resolution.items, band, limit)
      : resolution.items;

  const versionId = items[0]?.candidate.version_id ?? null;

  return {
    request_id: requestId,
    placement: placement.key,
    strategy_key: placement.strategy_key,
    resolved_strategy_key: resolution.resolved_strategy_key,
    fallback_used: resolution.fallback_used,
    fallback_chain: chain,
    version_id: versionId,
    limit,
    count: items.length,
    products: items.map(toServeProduct),
    served_context: {
      source_product_id: input.product_id ?? null,
      cart_id: input.cart_id ?? null,
      customer_id: input.customer_id ?? null,
      session_id: input.session_id ?? null,
      sales_channel_id: priceContext.sales_channel_id,
      region_id: priceContext.region_id,
      currency_code: priceContext.currency_code,
    },
    debug: {
      candidates_loaded: candidates.length,
      tiers: debugTiers,
      discarded: discardTotals,
    },
  };
}
