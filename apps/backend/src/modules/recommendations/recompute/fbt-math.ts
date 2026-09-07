import type { StrategyConfig } from '../config';

/**
 * Estadística de co-compra (PRD §6, "Frequently Bought Together"). Función PURA.
 *
 * El SQL agrega los conteos crudos por par (co-ocurrencias y las frecuencias de cada
 * producto) y ACÁ se calculan las métricas y se aplican los mínimos. La alternativa
 * —calcular todo en SQL con un INSERT … SELECT— es más rápida pero deja la
 * matemática sin test, y estos umbrales son justamente la diferencia entre
 * recomendar algo con fundamento y recomendar ruido. El volumen por lote está
 * acotado (N productos origen × max_relations_per_source), así que traer los
 * conteos a Node no es un problema.
 */

export type PairCounts = {
  source_product_id: string;
  target_product_id: string;
  /** Órdenes que contienen AMBOS productos. */
  co_occurrences: number;
  /** Órdenes que contienen el origen. */
  source_orders: number;
  /** Órdenes que contienen el destino. */
  target_orders: number;
};

export type PairMetrics = {
  source_product_id: string;
  target_product_id: string;
  co_occurrences: number;
  /** Proporción de todas las órdenes que contienen ambos. */
  support: number;
  /** P(destino | origen). Es el score: "quien compra A, cuántas veces compra B". */
  confidence: number;
  /** Cuánto más probable es B dado A que B por sí solo. 1 = independientes. */
  lift: number;
};

export type EvidenceGates = Pick<
  StrategyConfig,
  'min_orders_analyzed' | 'min_co_occurrences' | 'min_confidence' | 'min_lift' | 'max_relations_per_source'
>;

/**
 * Calcula support, confidence y lift de un par.
 *
 * `totalOrders` es la cantidad de órdenes analizadas (el universo). Con universo o
 * frecuencias en cero devuelve todo en cero en lugar de NaN/Infinity: una división
 * por cero acá terminaría escribiendo `NaN` en la columna de score y rompiendo el
 * ordenamiento del serve de forma silenciosa.
 */
export function pairMetrics(pair: PairCounts, totalOrders: number): PairMetrics {
  const safe = (value: number) => (Number.isFinite(value) ? value : 0);
  const support = totalOrders > 0 ? pair.co_occurrences / totalOrders : 0;
  const confidence = pair.source_orders > 0 ? pair.co_occurrences / pair.source_orders : 0;
  // lift = confidence / P(destino). Con P(destino) = 0 no hay lift definible.
  const targetProbability = totalOrders > 0 ? pair.target_orders / totalOrders : 0;
  const lift = targetProbability > 0 ? confidence / targetProbability : 0;

  return {
    source_product_id: pair.source_product_id,
    target_product_id: pair.target_product_id,
    co_occurrences: pair.co_occurrences,
    support: safe(support),
    confidence: safe(confidence),
    lift: safe(lift),
  };
}

export type QualifyResult = {
  qualified: PairMetrics[];
  /** Cuántos pares se descartaron, para el log de la corrida (PRD §20). */
  discarded: number;
  /** `true` si no hay suficientes órdenes para publicar NADA. */
  insufficient_data: boolean;
};

/**
 * Aplica los mínimos de evidencia y recorta a las mejores relaciones por origen.
 *
 * Reglas del PRD §6:
 *  - por debajo de `min_orders_analyzed` (50) no se publica NADA, aunque haya pares
 *    con números que parezcan buenos: con muestras chicas son casualidad;
 *  - `min_co_occurrences` (3) descarta el par que se vio una o dos veces;
 *  - el LIFT NUNCA es criterio único (§26): siempre se exige además co-ocurrencias y
 *    confianza mínimas, porque el lift explota con productos raros (un producto
 *    comprado 2 veces, ambas junto a otro, da lift altísimo y no significa nada).
 *
 * El orden del recorte es por confianza y después por co-ocurrencias: la confianza es
 * lo que responde a "quien compra esto, qué compra", y el desempate por volumen
 * prefiere la evidencia más sólida. El tercer desempate por id hace el resultado
 * determinista entre corridas.
 */
export function qualifyPairs(
  pairs: PairCounts[],
  totalOrders: number,
  gates: EvidenceGates,
): QualifyResult {
  if (totalOrders < gates.min_orders_analyzed) {
    return { qualified: [], discarded: pairs.length, insufficient_data: true };
  }

  const passing = pairs
    .filter((pair) => pair.co_occurrences >= gates.min_co_occurrences)
    .map((pair) => pairMetrics(pair, totalOrders))
    .filter((metrics) => metrics.confidence >= gates.min_confidence && metrics.lift >= gates.min_lift);

  const bySource = new Map<string, PairMetrics[]>();
  for (const metrics of passing) {
    const bucket = bySource.get(metrics.source_product_id);
    if (bucket) bucket.push(metrics);
    else bySource.set(metrics.source_product_id, [metrics]);
  }

  const qualified: PairMetrics[] = [];
  for (const bucket of bySource.values()) {
    bucket.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.co_occurrences - a.co_occurrences ||
        a.target_product_id.localeCompare(b.target_product_id),
    );
    qualified.push(...bucket.slice(0, gates.max_relations_per_source));
  }

  return {
    qualified,
    discarded: pairs.length - qualified.length,
    insufficient_data: false,
  };
}
