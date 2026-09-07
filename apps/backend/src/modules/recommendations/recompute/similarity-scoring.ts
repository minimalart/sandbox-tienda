import type { StrategyConfig } from '../config';

/**
 * Similitud por atributos del catálogo (PRD §6, "Productos similares"). Función PURA.
 *
 * No usa IA ni embeddings: la V1 cruza los atributos que el catálogo ya tiene. Eso la
 * hace explicable (se puede decir POR QUÉ dos productos son similares) y hace que
 * funcione el día uno, sin historial.
 *
 * El precio NO es señal acá a propósito: precios y promociones se mueven todo el
 * tiempo y meterlos en un cálculo que corre una vez por día produciría relaciones
 * desactualizadas. La proximidad de precio es un FILTRO del serve, que se evalúa con
 * el precio vigente en el momento de responder.
 */

export type SimilarityInput = {
  category_ids: string[];
  tag_values: string[];
  collection_id: string | null;
  type_id: string | null;
  brand_id: string | null;
};

/** Señales disponibles: si el catálogo no tiene tags o marcas, se redistribuye el peso. */
export type AvailableSignals = {
  tags: boolean;
  brand: boolean;
};

const jaccard = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let intersection = 0;
  const setA = new Set(a);
  for (const value of setA) if (setB.has(value)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
};

/**
 * Score de similitud en [0, 1].
 *
 * Los pesos se NORMALIZAN por la suma de los pesos efectivamente aplicables. Sin eso,
 * un catálogo sin tags daría scores tope 0.75 y los umbrales quedarían corridos
 * respecto de un catálogo con tags; con la normalización, "1" siempre significa
 * "coincide en todo lo que se puede comparar".
 */
export function scoreSimilarity(
  source: SimilarityInput,
  candidate: SimilarityInput,
  weights: StrategyConfig['similarity_weights'],
  available: AvailableSignals = { tags: true, brand: true },
): number {
  const parts: Array<{ weight: number; value: number }> = [];

  // Categorías: Jaccard sobre las ramas (las listas ya incluyen los padres), así que
  // subcategorías hermanas puntúan alto sin ser idénticas.
  parts.push({ weight: weights.category, value: jaccard(source.category_ids, candidate.category_ids) });

  if (available.tags) {
    parts.push({ weight: weights.tags, value: jaccard(source.tag_values, candidate.tag_values) });
  }
  parts.push({
    weight: weights.collection,
    value: source.collection_id && source.collection_id === candidate.collection_id ? 1 : 0,
  });
  parts.push({
    weight: weights.type,
    value: source.type_id && source.type_id === candidate.type_id ? 1 : 0,
  });
  if (available.brand) {
    parts.push({
      weight: weights.brand,
      value: source.brand_id && source.brand_id === candidate.brand_id ? 1 : 0,
    });
  }

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return 0;

  const score = parts.reduce((sum, part) => sum + part.weight * part.value, 0) / totalWeight;
  // Se redondea para que el score sea estable entre corridas y no genere diffs por
  // ruido de punto flotante.
  return Math.round(Math.min(1, Math.max(0, score)) * 10_000) / 10_000;
}

/**
 * Ordena candidatos por score y recorta. Descarta los de score 0: no comparten NADA
 * comparable con el origen y recomendarlos sería peor que no recomendar nada.
 */
export function rankSimilar<T extends { target_product_id: string; score: number }>(
  candidates: T[],
  limit: number,
): T[] {
  return [...candidates]
    .filter((candidate) => candidate.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.target_product_id.localeCompare(b.target_product_id),
    )
    .slice(0, limit);
}
