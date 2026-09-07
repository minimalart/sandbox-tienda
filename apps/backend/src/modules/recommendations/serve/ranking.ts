import type { ChainResolution, ResolvedTier, ScoredCandidate } from '../types';

/**
 * Ranking y recorrido de la cadena de fallbacks. Funciones PURAS.
 */

/**
 * Ordena candidatos: prioridad manual, después score automático.
 *
 * `priority` gana sobre `score` a propósito: es el control explícito del merchant y
 * tiene que poder imponerse sobre cualquier cálculo. Los desempates
 * (`co_occurrences`, luego id) existen para que el orden sea DETERMINISTA: sin
 * ellos, dos requests idénticos pueden devolver órdenes distintas y la métrica de
 * posición (`position`) deja de significar nada.
 */
export function rankCandidates(items: ScoredCandidate[]): ScoredCandidate[] {
  return [...items].sort((a, b) => {
    const ca = a.candidate;
    const cb = b.candidate;
    if (cb.priority !== ca.priority) return cb.priority - ca.priority;
    if (cb.score !== ca.score) return cb.score - ca.score;
    const coA = ca.co_occurrences ?? -1; // nulls al final
    const coB = cb.co_occurrences ?? -1;
    if (coB !== coA) return coB - coA;
    return ca.target_product_id.localeCompare(cb.target_product_id);
  });
}

/**
 * Recorre la cadena de fallbacks y elige el eslabón que responde (PRD §7).
 *
 * Se queda con el primer tier que alcanza `minResults`. Si ninguno llega, devuelve
 * el que más candidatos válidos consiguió en lugar de una respuesta vacía: mostrar
 * 2 recomendaciones relevantes es mejor que no mostrar nada, y el consumidor ya
 * sabe por `resolved_strategy_key` y `fallback_used` con qué se quedó.
 *
 * Los tiers llegan ya filtrados. Filtrar todos y después elegir cuesta unos
 * microsegundos de JS sobre un set acotado y ahorra round trips: la hidratación es
 * un solo batch para la unión de la cadena entera.
 */
export function resolveChain(
  tiers: ResolvedTier[],
  opts: { limit: number; minResults: number },
): ChainResolution {
  const minResults = Math.max(1, Math.min(opts.minResults, opts.limit));

  for (const [index, tier] of tiers.entries()) {
    if (tier.kept.length >= minResults) {
      return {
        resolved_strategy_key: tier.strategy_key,
        fallback_used: index > 0,
        tier_index: index,
        items: tier.kept.slice(0, opts.limit),
      };
    }
  }

  // Ningún tier llegó al mínimo: el mejor esfuerzo. La comparación es estricta para
  // que ante empate gane el tier más específico (el primero de la cadena).
  let best: { index: number; tier: ResolvedTier } | null = null;
  for (const [index, tier] of tiers.entries()) {
    if (tier.kept.length > (best?.tier.kept.length ?? 0)) best = { index, tier };
  }

  if (!best) {
    return {
      resolved_strategy_key: null,
      fallback_used: false,
      tier_index: -1,
      items: [],
    };
  }

  return {
    resolved_strategy_key: best.tier.strategy_key,
    fallback_used: best.index > 0,
    tier_index: best.index,
    items: best.tier.kept.slice(0, opts.limit),
  };
}
