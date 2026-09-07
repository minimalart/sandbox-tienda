/**
 * fleet-eligibility — filtrado PURO de recursos de flota propia (drivers /
 * vehicles) contra el requerimiento de UNA orden. Sin DB ni container: recibe
 * los candidatos YA materializados (con su carga actual, turnos y zonas
 * resueltas) y devuelve quiénes son elegibles y por qué se rechaza a cada uno.
 *
 * Misma filosofía que rules-engine.ts / route-optimizer.ts: función
 * determinística, testeable en aislamiento con node --test. El service
 * (getEligibleResources) es el ÚNICO que toca DB; arma los candidatos y delega
 * acá la decisión.
 *
 * DECISIONES DE DISEÑO
 * --------------------------------------------------------------------------
 *  - Driver SIN turnos definidos = ELEGIBLE por horario. Si un driver no tiene
 *    NINGÚN shift cargado, lo tratamos como "sin restricción horaria" en lugar
 *    de excluirlo. Excluirlos dejaría a todos los drivers sin grilla cargada
 *    fuera del pool, que es el estado inicial más común; preferimos un default
 *    permisivo y que el operador AGREGUE turnos para restringir.
 *  - status 'on_route' SE PERMITE: un driver en ruta puede tomar otra entrega
 *    mientras no exceda su tope de carga. Solo 'offline' excluye.
 *  - zone_ids null = recurso NO restringido por zona (elegible en cualquier
 *    zona). zone_ids [] = recurso restringido y NO mapeado a la zona pedida →
 *    excluido. La semántica null-vs-array la resuelve el service desde
 *    ZoneResource (ver getEligibleResources).
 *  - Comparación horaria 'HH:mm' LEXICOGRÁFICA: mismo criterio que el motor de
 *    reglas (cutoff_time / time_of_day). Solo válida con cero-padding ('09:00').
 */

import type { TemperatureMode } from './types';

/**
 * Severidad de frío por modo (mayor = más frío). Réplica LOCAL de
 * TEMPERATURE_SEVERITY de types.ts a propósito: mantener el módulo con SOLO
 * imports type-only (que se borran en runtime) lo hace ejecutable directo con
 * `node --test` sin cadena de imports de valor que requiera extensión .ts.
 * Es un mapeo trivial y estable (3 modos); si cambia, se actualiza en ambos
 * lados — el test de temperatureRank lo fija como contrato.
 */
const TEMP_SEVERITY: Record<TemperatureMode, number> = {
  ambient: 0,
  refrigerated: 1,
  frozen: 2,
};

/** Requerimiento derivado de la orden a satisfacer con un recurso de flota. */
export interface FleetRequirement {
  /** Peso total de la orden (kg). null = desconocido (no filtra por peso). */
  weight_kg: number | null;
  /** Volumen total (m³). null = desconocido (no filtra por volumen). */
  volume_m3: number | null;
  /** Cantidad de items / bultos de la orden. */
  item_count: number;
  /** Requerimiento de frío de la orden (máximo de sus items). */
  temperature: TemperatureMode;
  /** Zona logística resuelta para la orden. null = sin zona resuelta. */
  zone_id: string | null;
  /** Hora local 'HH:mm' del momento de despacho (para turnos). */
  now_hhmm: string;
  /** Día de la semana 0..6 (convención JS Date.getDay(), 0=domingo). */
  day_of_week: number;
}

/** Franja horaria de un driver (forma de DriverShift, ya filtrada o no). */
export interface CandidateShift {
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

/** Candidato driver, con su carga actual y zonas ya resueltas por el service. */
export interface DriverCandidate {
  id: string;
  /** available | on_route | offline. */
  status: string;
  active: boolean;
  /** Tope de entregas activas simultáneas. null = sin tope. */
  max_active_deliveries: number | null;
  /** Entregas no terminales ya asignadas a este driver (carga actual). */
  active_deliveries: number;
  /** Turnos del driver. Vacío = sin grilla cargada → sin restricción horaria. */
  shifts: CandidateShift[];
  /** Zonas habilitadas. null = no restringido por zona; [] = restringido y sin zona. */
  zone_ids: string[] | null;
}

/** Candidato vehicle, con capacidad y zonas ya resueltas por el service. */
export interface VehicleCandidate {
  id: string;
  active: boolean;
  type: string;
  capacity_kg: number | null;
  capacity_m3: number | null;
  /** Tope de órdenes por viaje. null = sin tope. */
  max_orders: number | null;
  has_refrigeration: boolean;
  /** Modos de temperatura soportados. null = no declarado. */
  temperature_modes: string[] | null;
  /** Zonas habilitadas. null = no restringido por zona; [] = restringido y sin zona. */
  zone_ids: string[] | null;
}

/** Resultado de la elegibilidad para una orden. */
export interface EligibilityResult {
  /** Drivers elegibles con su carga actual (para priorizar al menos cargado). */
  eligible_drivers: { id: string; load: number }[];
  /** Vehicles elegibles. */
  eligible_vehicles: { id: string }[];
  /** Recursos rechazados con el motivo del PRIMER filtro que falló. */
  rejected: { resource_type: string; id: string; reason: string }[];
}

/** Severidad de frío de un modo (mayor = más frío). */
export const temperatureRank = (t: TemperatureMode): number =>
  TEMP_SEVERITY[t] ?? 0;

/** True si la zona pedida está habilitada para un recurso con `zoneIds`. */
const zoneAllows = (zoneIds: string[] | null, zoneId: string | null): boolean => {
  // null = sin restricción de zona: elegible en cualquier zona (incluso sin zona).
  if (zoneIds === null) return true;
  // Restringido por zona pero la orden no tiene zona resuelta: no podemos
  // afirmar pertenencia → excluido.
  if (zoneId === null) return false;
  return zoneIds.includes(zoneId);
};

/** True si alguna franja activa del driver cubre (day_of_week, now_hhmm). */
const shiftCovers = (shifts: CandidateShift[], req: FleetRequirement): boolean => {
  const active = shifts.filter((s) => s.active);
  // Sin NINGÚN turno (activo o no): sin grilla cargada → sin restricción horaria.
  if (shifts.length === 0) return true;
  // Hay turnos pero ninguno activo: el operador desactivó toda la grilla →
  // tratamos como restringido y fuera de turno (no hay ventana vigente).
  if (active.length === 0) return false;
  return active.some(
    (s) =>
      s.day_of_week === req.day_of_week &&
      s.start_time <= req.now_hhmm &&
      req.now_hhmm <= s.end_time,
  );
};

/**
 * ¿Es elegible este driver para la orden? Filtros en AND, en orden de costo
 * creciente. Devuelve el PRIMER motivo de rechazo (estable y determinístico).
 */
export const isDriverEligible = (
  d: DriverCandidate,
  req: FleetRequirement,
): { ok: boolean; reason?: string } => {
  if (!d.active) return { ok: false, reason: 'inactive' };
  if (d.status === 'offline') return { ok: false, reason: 'offline' };
  if (
    d.max_active_deliveries != null &&
    d.active_deliveries >= d.max_active_deliveries
  ) {
    return { ok: false, reason: 'overloaded' };
  }
  if (!shiftCovers(d.shifts, req)) return { ok: false, reason: 'off_shift' };
  if (!zoneAllows(d.zone_ids, req.zone_id)) {
    return { ok: false, reason: 'zone_not_allowed' };
  }
  return { ok: true };
};

/**
 * ¿Es elegible este vehículo para la orden? Filtros en AND. Devuelve el PRIMER
 * motivo de rechazo.
 *
 * Temperatura: si la orden requiere frío (refrigerated/frozen) el vehículo debe
 * soportar ESE modo — declarado en temperature_modes, o has_refrigeration cubre
 * el caso 'refrigerated' (un vehículo refrigerado no necesariamente congela, así
 * que 'frozen' EXIGE declararlo en temperature_modes).
 */
export const isVehicleEligible = (
  v: VehicleCandidate,
  req: FleetRequirement,
): { ok: boolean; reason?: string } => {
  if (!v.active) return { ok: false, reason: 'inactive' };

  if (
    req.weight_kg != null &&
    v.capacity_kg != null &&
    req.weight_kg > v.capacity_kg
  ) {
    return { ok: false, reason: 'over_weight' };
  }

  if (
    req.volume_m3 != null &&
    v.capacity_m3 != null &&
    req.volume_m3 > v.capacity_m3
  ) {
    return { ok: false, reason: 'over_volume' };
  }

  if (v.max_orders != null && req.item_count > v.max_orders) {
    return { ok: false, reason: 'over_orders' };
  }

  if (req.temperature !== 'ambient') {
    const modes = Array.isArray(v.temperature_modes) ? v.temperature_modes : [];
    const declared = modes.includes(req.temperature);
    const refrigeratedByFlag =
      req.temperature === 'refrigerated' && v.has_refrigeration === true;
    if (!declared && !refrigeratedByFlag) {
      return { ok: false, reason: 'no_temperature_support' };
    }
  }

  if (!zoneAllows(v.zone_ids, req.zone_id)) {
    return { ok: false, reason: 'zone_not_allowed' };
  }

  return { ok: true };
};

/**
 * Filtra drivers y vehicles contra el requerimiento. Determinístico: preserva el
 * orden de entrada en eligible_* y rejected. Los drivers elegibles llevan su
 * carga actual para que el caller priorice al menos cargado.
 */
export const selectEligible = (
  drivers: DriverCandidate[],
  vehicles: VehicleCandidate[],
  req: FleetRequirement,
): EligibilityResult => {
  const eligibleDrivers: { id: string; load: number }[] = [];
  const eligibleVehicles: { id: string }[] = [];
  const rejected: { resource_type: string; id: string; reason: string }[] = [];

  for (const d of drivers) {
    const verdict = isDriverEligible(d, req);
    if (verdict.ok) {
      eligibleDrivers.push({ id: d.id, load: d.active_deliveries });
    } else {
      rejected.push({
        resource_type: 'driver',
        id: d.id,
        reason: verdict.reason ?? 'rejected',
      });
    }
  }

  for (const v of vehicles) {
    const verdict = isVehicleEligible(v, req);
    if (verdict.ok) {
      eligibleVehicles.push({ id: v.id });
    } else {
      rejected.push({
        resource_type: 'vehicle',
        id: v.id,
        reason: verdict.reason ?? 'rejected',
      });
    }
  }

  return {
    eligible_drivers: eligibleDrivers,
    eligible_vehicles: eligibleVehicles,
    rejected,
  };
};
