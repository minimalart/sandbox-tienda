import { referencePrice } from './filters';
import type { ScoredCandidate } from '../types';

/**
 * Selección de bridge products (PRD §9.5). Función PURA.
 *
 * El caso: al carrito le faltan $8.000 para el envío gratis y queremos ofrecer
 * productos que ayuden a cruzar ese umbral.
 */

export type BridgeBand = {
  /** Monto faltante para el envío gratis. */
  target_price: number;
  price_min: number;
  price_max: number;
};

/**
 * Deriva la banda elegible a partir del monto faltante.
 *
 * La banda es ASIMÉTRICA porque así es el ejemplo del PRD (falta $8.000 → elegible
 * $6.000 a $12.000): tiene sentido ofrecer algo bastante más caro que el faltante
 * —igual cruza el umbral— pero no algo mucho más barato, que no alcanza.
 */
export function bridgeBand(
  targetPrice: number,
  factors: { lower: number; upper: number },
): BridgeBand {
  const target = Math.max(0, targetPrice);
  return {
    target_price: target,
    price_min: Math.round(target * factors.lower),
    price_max: Math.round(target * factors.upper),
  };
}

/**
 * Ordena los candidatos por utilidad para cerrar el envío gratis.
 *
 * Primero los que CRUZAN el umbral solos, del más barato al más caro: son los que
 * de verdad resuelven el problema, y el más barato es el que menos plata extra pide
 * al cliente. Después los que se quedan cortos, del más caro al más barato (los más
 * cerca de alcanzarlo).
 *
 * Espera candidatos ya filtrados por `applyEligibilityFilters` (stock, canal,
 * carrito, banda de precio). Los que no tienen precio de referencia se descartan:
 * sin precio no se puede razonar sobre el umbral.
 */
export function selectBridgeProducts(
  items: ScoredCandidate[],
  band: BridgeBand,
  limit: number,
): ScoredCandidate[] {
  const priced = items
    .map((item) => ({ item, price: referencePrice(item.product) }))
    .filter((entry): entry is { item: ScoredCandidate; price: number } => entry.price !== null);

  const crosses = priced.filter((e) => e.price >= band.target_price);
  const short = priced.filter((e) => e.price < band.target_price);

  // Desempate por id en ambos grupos: el orden tiene que ser determinista para que
  // la cache del motor y la métrica de posición signifiquen algo.
  crosses.sort(
    (a, b) =>
      a.price - b.price ||
      a.item.candidate.target_product_id.localeCompare(b.item.candidate.target_product_id),
  );
  short.sort(
    (a, b) =>
      b.price - a.price ||
      a.item.candidate.target_product_id.localeCompare(b.item.candidate.target_product_id),
  );

  return [...crosses, ...short].slice(0, limit).map((e) => e.item);
}
