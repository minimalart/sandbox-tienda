/**
 * route-builder (F6 — auto-armado de rutas) — bin-packing PURO y DETERMINÍSTICO
 * de paradas (stops) de flota propia sobre los vehículos disponibles.
 *
 * Misma filosofía que route-optimizer.ts / fleet-eligibility.ts: función sin DB
 * ni container, testeable en aislamiento con `node --test`. El workflow
 * auto-build-routes es el ÚNICO que toca DB; arma los BuildableStop /
 * BuildableVehicle desde query.graph + el service y delega acá el reparto.
 *
 * Importa SOLO tipos (type-only) — nada de valores desde ./types — para que el
 * módulo se ejecute directo con node --test sin requerir extensión .ts en una
 * cadena de imports de valor. La compatibilidad de temperatura se replica acá de
 * forma local (mismo criterio que fleet-eligibility.isVehicleEligible).
 *
 * ALGORITMO: First-Fit-Decreasing (FFD).
 *  1) Ordenar los stops DESC por "carga dominante": primero order_count, luego
 *     weight_kg; desempate final por execution_id (orden estable y
 *     determinístico). Meter primero los más "pesados" reduce la fragmentación.
 *  2) Compatibilidad de temperatura: un stop refrigerated/frozen SOLO entra a un
 *     vehículo que soporte ese modo (temperature_modes incluye el modo, o
 *     has_refrigeration cubre 'refrigerated'). Un vehículo apto a frío PUEDE
 *     llevar carga ambient sin problema.
 *  3) fill_priority:
 *       'fill_first' (default) → recorre los vehículos en orden determinístico y
 *         satura cada uno (hasta el tope de órdenes / capacity_kg / capacity_m3)
 *         antes de pasar al siguiente. Tiende a usar la menor cantidad de
 *         vehículos.
 *       'balance' → reparte round-robin entre los vehículos compatibles para
 *         equilibrar la carga.
 *  4) Un stop sin NINGÚN vehículo compatible/con cupo cae en `unassigned`.
 *  5) Los stops sin lat/lng igual se empacan: la geolocalización solo importa al
 *     optimizar el orden DESPUÉS (optimize-route), no para el reparto por carga.
 *
 * ORDEN DE VEHÍCULOS (criterio determinístico, documentado):
 *  Se ordenan DESC por capacidad — primero capacity_kg, luego capacity_m3, luego
 *  max_orders — con desempate final ASC por id. Un null de capacidad cuenta como
 *  +Infinity (sin tope ⇒ "más grande"), así los vehículos sin límite declarado se
 *  consideran los de mayor capacidad y se llenan primero en 'fill_first'. Esto
 *  prioriza consolidar en los vehículos grandes y deja los chicos como overflow.
 */

import type { TemperatureMode } from './types';

/** Una parada candidata a empacar (deriva de una DeliveryExecution + su orden). */
export interface BuildableStop {
  execution_id: string;
  /** Peso total de la orden (kg). 0 si desconocido (no aporta al filtro de peso). */
  weight_kg: number;
  /** Volumen total (m³). 0 si desconocido. */
  volume_m3: number;
  /** Cantidad de órdenes que cuenta este stop hacia el tope del vehículo. */
  order_count: number;
  /** Requerimiento de frío de la orden (máximo de sus items). */
  temperature: TemperatureMode;
  /** Coordenadas; opcionales — no afectan el reparto, solo la optimización posterior. */
  lat?: number | null;
  lng?: number | null;
}

/** Un vehículo disponible para recibir stops. */
export interface BuildableVehicle {
  id: string;
  /** Capacidad de peso (kg). null = sin tope. */
  capacity_kg: number | null;
  /** Capacidad de volumen (m³). null = sin tope. */
  capacity_m3: number | null;
  /** Tope de órdenes por viaje. null = sin tope. */
  max_orders: number | null;
  /** El vehículo puede transportar carga refrigerada/congelada. */
  has_refrigeration: boolean;
  /** Modos de temperatura soportados. null = no declarado. */
  temperature_modes: string[] | null;
}

/** Un "bin" = un vehículo con los stops que se le asignaron + sus totales. */
export interface BuiltBin {
  /** Vehículo del bin. null sería un bin sin vehículo (no se genera acá). */
  vehicle_id: string | null;
  /** Ejecuciones asignadas, en el orden de empaque (no es el orden de ruteo). */
  execution_ids: string[];
  /** Totales acumulados del bin. */
  totals: {
    weight_kg: number;
    volume_m3: number;
    order_count: number;
  };
}

/** Resultado del bin-packing: bins con carga + ejecuciones sin asignar. */
export interface BuildRoutesResult {
  bins: BuiltBin[];
  unassigned: string[];
}

/** Opciones del reparto. */
export interface BuildRoutesOptions {
  /**
   * Tope GLOBAL de órdenes por vehículo. Se combina con vehicle.max_orders vía
   * min(): el efectivo es el menor de ambos (si alguno es null, manda el otro).
   */
  max_orders_per_vehicle?: number | null;
  /** Estrategia de llenado. Default 'fill_first'. */
  fill_priority?: 'fill_first' | 'balance';
}

/**
 * ¿El vehículo soporta el modo de temperatura del stop? Mismo criterio que
 * fleet-eligibility.isVehicleEligible: 'ambient' lo soporta cualquiera; frío
 * exige declararlo en temperature_modes, salvo 'refrigerated' que también lo
 * cubre has_refrigeration. 'frozen' EXIGE declararlo (refrigerar no es congelar).
 */
const vehicleSupportsTemperature = (
  v: BuildableVehicle,
  temperature: TemperatureMode,
): boolean => {
  if (temperature === 'ambient') return true;
  const modes = Array.isArray(v.temperature_modes) ? v.temperature_modes : [];
  if (modes.includes(temperature)) return true;
  if (temperature === 'refrigerated' && v.has_refrigeration === true) return true;
  return false;
};

/** Tope efectivo de órdenes de un vehículo: min(vehicle.max_orders, global). */
const effectiveMaxOrders = (
  v: BuildableVehicle,
  globalMax: number | null | undefined,
): number | null => {
  const a = v.max_orders == null ? null : v.max_orders;
  const b = globalMax == null ? null : globalMax;
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
};

/** Estado mutable de un bin durante el empaque. */
interface BinState {
  vehicle: BuildableVehicle;
  execution_ids: string[];
  weight_kg: number;
  volume_m3: number;
  order_count: number;
}

/**
 * ¿Entra `stop` en `bin` sin violar capacidad/tope? Asume temperatura ya
 * verificada por el caller (el bin se preselecciona por compatibilidad).
 */
const fitsInBin = (
  bin: BinState,
  stop: BuildableStop,
  globalMax: number | null | undefined,
): boolean => {
  const max = effectiveMaxOrders(bin.vehicle, globalMax);
  if (max != null && bin.order_count + stop.order_count > max) return false;

  const cap_kg = bin.vehicle.capacity_kg;
  if (cap_kg != null && bin.weight_kg + stop.weight_kg > cap_kg) return false;

  const cap_m3 = bin.vehicle.capacity_m3;
  if (cap_m3 != null && bin.volume_m3 + stop.volume_m3 > cap_m3) return false;

  return true;
};

/** Mete `stop` en `bin` mutando sus totales. */
const placeInBin = (bin: BinState, stop: BuildableStop): void => {
  bin.execution_ids.push(stop.execution_id);
  bin.weight_kg += stop.weight_kg;
  bin.volume_m3 += stop.volume_m3;
  bin.order_count += stop.order_count;
};

/**
 * Capacidad "score" de un vehículo para ordenarlos DESC. null = sin tope =
 * +Infinity (cuenta como el más grande).
 */
const cap = (v: number | null): number => (v == null ? Infinity : v);

/**
 * Ordena los vehículos de forma determinística: DESC por capacity_kg, luego
 * capacity_m3, luego max_orders; desempate final ASC por id. Ver doc de cabecera.
 */
const orderVehicles = (vehicles: BuildableVehicle[]): BuildableVehicle[] =>
  vehicles.slice().sort((a, b) => {
    if (cap(a.capacity_kg) !== cap(b.capacity_kg)) {
      return cap(b.capacity_kg) - cap(a.capacity_kg);
    }
    if (cap(a.capacity_m3) !== cap(b.capacity_m3)) {
      return cap(b.capacity_m3) - cap(a.capacity_m3);
    }
    if (cap(a.max_orders) !== cap(b.max_orders)) {
      return cap(b.max_orders) - cap(a.max_orders);
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

/**
 * Ordena los stops DESC por carga dominante (order_count, luego weight_kg);
 * desempate final ASC por execution_id. Determinístico (FFD).
 */
const orderStopsDecreasing = (stops: BuildableStop[]): BuildableStop[] =>
  stops.slice().sort((a, b) => {
    if (a.order_count !== b.order_count) return b.order_count - a.order_count;
    if (a.weight_kg !== b.weight_kg) return b.weight_kg - a.weight_kg;
    return a.execution_id < b.execution_id
      ? -1
      : a.execution_id > b.execution_id
        ? 1
        : 0;
  });

/** Construye el resultado a partir de los bins, descartando los vacíos. */
const toResult = (bins: BinState[], unassigned: string[]): BuildRoutesResult => ({
  bins: bins
    .filter((b) => b.execution_ids.length > 0)
    .map((b) => ({
      vehicle_id: b.vehicle.id,
      execution_ids: b.execution_ids,
      totals: {
        weight_kg: b.weight_kg,
        volume_m3: b.volume_m3,
        order_count: b.order_count,
      },
    })),
  unassigned,
});

/**
 * Reparte los stops entre los vehículos disponibles (First-Fit-Decreasing).
 *
 * Determinístico: misma entrada → misma salida. No usa Math.random ni Date. El
 * orden de los stops dentro de cada bin es el orden de empaque (por carga
 * decreciente), NO el orden de ruteo — eso lo resuelve optimize-route después.
 */
export const buildRoutes = (
  stops: BuildableStop[],
  vehicles: BuildableVehicle[],
  opts: BuildRoutesOptions = {},
): BuildRoutesResult => {
  const fillPriority = opts.fill_priority ?? 'fill_first';
  const globalMax = opts.max_orders_per_vehicle ?? null;

  const orderedVehicles = orderVehicles(vehicles);
  const bins: BinState[] = orderedVehicles.map((vehicle) => ({
    vehicle,
    execution_ids: [],
    weight_kg: 0,
    volume_m3: 0,
    order_count: 0,
  }));

  const orderedStops = orderStopsDecreasing(stops);
  const unassigned: string[] = [];

  // round-robin: puntero de arranque para 'balance' (rota por stop).
  let rrCursor = 0;

  for (const stop of orderedStops) {
    // Candidatos: bins cuyo vehículo soporta la temperatura del stop.
    const candidateIndexes: number[] = [];
    for (let i = 0; i < bins.length; i++) {
      if (vehicleSupportsTemperature(bins[i]!.vehicle, stop.temperature)) {
        candidateIndexes.push(i);
      }
    }

    if (candidateIndexes.length === 0) {
      unassigned.push(stop.execution_id);
      continue;
    }

    let placed = false;

    if (fillPriority === 'balance') {
      // Round-robin: arranca en rrCursor y prueba en orden circular sobre los
      // candidatos compatibles, eligiendo el primero con cupo. Avanza el cursor
      // para repartir parejo entre vehículos.
      const k = candidateIndexes.length;
      for (let off = 0; off < k; off++) {
        const idx = candidateIndexes[(rrCursor + off) % k]!;
        if (fitsInBin(bins[idx]!, stop, globalMax)) {
          placeInBin(bins[idx]!, stop);
          rrCursor = (rrCursor + off + 1) % k;
          placed = true;
          break;
        }
      }
    } else {
      // fill_first: primer bin (en orden determinístico de vehículos) con cupo.
      for (const idx of candidateIndexes) {
        if (fitsInBin(bins[idx]!, stop, globalMax)) {
          placeInBin(bins[idx]!, stop);
          placed = true;
          break;
        }
      }
    }

    if (!placed) unassigned.push(stop.execution_id);
  }

  return toResult(bins, unassigned);
};
