import type { AttributionKind } from '../models';

/**
 * Clasificación de compras atribuidas (PRD §14.3/§14.4). Función PURA.
 *
 * Dos niveles, y se reportan SEPARADOS (nunca sumados):
 *
 *   DIRECTA  clic → agregado al carrito → compra. Es la cadena causal completa: el
 *            usuario vio la recomendación, la clickeó y de ahí la agregó.
 *   ASISTIDA vio la recomendación y después compró ese producto, pero sin la cadena.
 *            Es influencia plausible, no causalidad demostrada.
 *
 * Sumarlas daría un número inflado que nadie podría defender en una reunión, y por eso el
 * PRD pide columnas distintas.
 */

export type TimelineEvent = {
  event: string;
  product_id: string | null;
  occurred_at: string | Date;
  placement: string | null;
  strategy_key: string | null;
  resolved_strategy_key: string | null;
  version_id: string | null;
  request_id: string;
};

export type AttributionResult = {
  attribution: AttributionKind;
  /** Dimensiones del evento MÁS ESPECÍFICO que matcheó. */
  placement: string | null;
  strategy_key: string | null;
  resolved_strategy_key: string | null;
  version_id: string | null;
  request_id: string | null;
};

const NO_ATTRIBUTION: AttributionResult = {
  attribution: 'none',
  placement: null,
  strategy_key: null,
  resolved_strategy_key: null,
  version_id: null,
  request_id: null,
};

const timeOf = (event: TimelineEvent): number => {
  const value = new Date(event.occurred_at).getTime();
  return Number.isFinite(value) ? value : 0;
};

const dimensionsOf = (event: TimelineEvent, attribution: AttributionKind): AttributionResult => ({
  attribution,
  placement: event.placement,
  strategy_key: event.strategy_key,
  resolved_strategy_key: event.resolved_strategy_key,
  version_id: event.version_id,
  request_id: event.request_id,
});

/**
 * Clasifica la compra de UN producto según su timeline de interacciones.
 *
 * `timeline` son los eventos de ese producto, en cualquier orden.
 *
 * El crédito se asigna con las dimensiones del evento más específico
 * (`added_to_cart` > `clicked` > `viewed`), para que quede en el widget que
 * efectivamente convirtió y no en el primero que lo mostró.
 *
 * La cadena directa exige `clicked` ANTES de `added_to_cart`. Si el usuario agregó el
 * producto desde otro lado y sólo después clickeó la recomendación, no hay causalidad:
 * eso es asistida. Comparar por `<=` y no `<` porque los dos eventos pueden caer en el
 * mismo milisegundo (el agregado suele dispararse en el mismo gesto que el clic).
 */
export function classifyAttribution(timeline: TimelineEvent[]): AttributionResult {
  if (!timeline.length) return NO_ATTRIBUTION;

  const clicks = timeline.filter((event) => event.event === 'recommendation_clicked');
  const addToCarts = timeline.filter((event) => event.event === 'recommendation_added_to_cart');
  const views = timeline.filter(
    (event) => event.event === 'recommendation_viewed' || event.event === 'recommendation_served',
  );

  // Directa: existe algún par (clic, agregado) del MISMO request en el orden correcto.
  // Se exige el mismo `request_id` porque un clic en un rail y un agregado en otro no
  // forman una cadena: son dos interacciones distintas.
  for (const add of addToCarts) {
    const matchingClick = clicks.find(
      (click) => click.request_id === add.request_id && timeOf(click) <= timeOf(add),
    );
    if (matchingClick) return dimensionsOf(add, 'direct');
  }

  // Asistida: hubo agregado sin clic previo, o clic sin agregado, o sólo vista.
  const mostSpecific = addToCarts[0] ?? clicks[0] ?? views[0];
  if (mostSpecific) return dimensionsOf(mostSpecific, 'assisted');

  return NO_ATTRIBUTION;
}

/**
 * Agrupa un timeline plano por producto, ordenando cada grupo cronológicamente.
 *
 * El orden importa: `classifyAttribution` compara timestamps para decidir si la cadena
 * clic→agregado está en el orden correcto.
 */
export function groupTimelineByProduct(
  events: TimelineEvent[],
): Map<string, TimelineEvent[]> {
  const grouped = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    if (!event.product_id) continue;
    const bucket = grouped.get(event.product_id);
    if (bucket) bucket.push(event);
    else grouped.set(event.product_id, [event]);
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => timeOf(a) - timeOf(b));
  }
  return grouped;
}
