/**
 * assignment-strategies — selección PURA de un driver / vehicle de entre los
 * elegibles, según una estrategia. Misma filosofía que fleet-eligibility.ts /
 * rules-engine.ts: funciones determinísticas, sin DB ni container, testeables
 * en aislamiento con `node --test`.
 *
 * El service/workflow resuelve la elegibilidad (getEligibleResources) y el
 * estado de round-robin (DeliveryZone.metadata); acá SOLO decidimos a quién
 * elegir dado ese input ya materializado. El llamador es responsable de
 * persistir el nuevo estado de round-robin.
 *
 * DETERMINISMO: todas las estrategias ordenan por `id` ascendente como
 * desempate final, de modo que dado el mismo input siempre devuelven el mismo
 * resultado (idempotencia para tests y reproceso).
 */

/** Estrategia de asignación automática de flota propia. */
export type AssignStrategy = 'round_robin' | 'first_available' | 'least_load';

export const ASSIGN_STRATEGIES: AssignStrategy[] = [
  'round_robin',
  'first_available',
  'least_load',
];

/** True si `s` es una AssignStrategy válida. */
export const isValidAssignStrategy = (s: string): s is AssignStrategy =>
  (ASSIGN_STRATEGIES as string[]).includes(s);

/** Driver elegible con su carga actual (forma de EligibilityResult.eligible_drivers). */
export interface EligibleDriver {
  id: string;
  load: number;
}

/** Vehículo elegible; capacity_kg opcional habilita el best-fit. */
export interface EligibleVehicle {
  id: string;
  capacity_kg?: number | null;
}

/** Estado externo que necesita round_robin (persistido en metadata de zona). */
export interface AssignState {
  /** Último driver asignado por round-robin en este scope (zona). */
  last_assigned_driver_id?: string | null;
}

/** Orden estable por id ascendente (no muta el array de entrada). */
const byIdAsc = <T extends { id: string }>(xs: readonly T[]): T[] =>
  [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/**
 * Elige un driver de entre los elegibles según la estrategia.
 *
 *  - first_available: primer elegible por id ascendente (determinístico).
 *  - least_load:      menor `load`; desempate por id ascendente.
 *  - round_robin:     ordena por id ascendente y elige el PRIMERO con
 *                     id > last_assigned_driver_id; si no hay ninguno mayor
 *                     (o no hay estado previo), vuelve al primero (wrap).
 *
 * Devuelve null si no hay elegibles.
 */
export const pickDriver = (
  eligible: readonly EligibleDriver[],
  strategy: AssignStrategy,
  state: AssignState = {},
): string | null => {
  if (eligible.length === 0) return null;

  const sorted = byIdAsc(eligible);

  switch (strategy) {
    case 'first_available':
      return sorted[0]!.id;

    case 'least_load': {
      // Mínimo load; el orden previo (id asc) garantiza el desempate estable.
      let best = sorted[0]!;
      for (const d of sorted) {
        if (d.load < best.load) best = d;
      }
      return best.id;
    }

    case 'round_robin': {
      const last = state.last_assigned_driver_id ?? null;
      if (last === null) return sorted[0]!.id;
      // Primero con id estrictamente mayor al último asignado; si no hay,
      // wrap al primero. Esto rota de forma determinística por id.
      const next = sorted.find((d) => d.id > last);
      return (next ?? sorted[0]!).id;
    }

    default:
      // Estrategia desconocida → fallback determinístico al primero.
      return sorted[0]!.id;
  }
};

/**
 * Elige un vehículo de entre los elegibles (best-fit simple).
 *
 *  - Si AL MENOS un elegible declara `capacity_kg` (número finito), aplica
 *    best-fit: el de MENOR capacidad entre los que la declaran (cabe más
 *    ajustado, deja los grandes libres). Desempate por id ascendente. Los que
 *    no declaran capacidad quedan como fallback solo si ninguno la declara.
 *  - Si NINGÚN elegible declara capacidad, devuelve el primero por id asc.
 *
 * `strategy` no afecta hoy la elección de vehículo (el best-fit es único), pero
 * se acepta para mantener la firma simétrica con pickDriver y permitir futuras
 * variantes sin romper llamadores.
 *
 * Devuelve null si no hay elegibles.
 */
export const pickVehicle = (
  eligible: readonly EligibleVehicle[],
  _strategy?: AssignStrategy,
): string | null => {
  void _strategy;
  if (eligible.length === 0) return null;

  const sorted = byIdAsc(eligible);

  const withCapacity = sorted.filter(
    (v): v is EligibleVehicle & { capacity_kg: number } =>
      typeof v.capacity_kg === 'number' && Number.isFinite(v.capacity_kg),
  );

  // Sin info de capacidad en ningún elegible → primero por id asc.
  if (withCapacity.length === 0) return sorted[0]!.id;

  // Best-fit: menor capacidad; id asc como desempate estable (ya viene ordenado).
  let best = withCapacity[0]!;
  for (const v of withCapacity) {
    if (v.capacity_kg < best.capacity_kg) best = v;
  }
  return best.id;
};
