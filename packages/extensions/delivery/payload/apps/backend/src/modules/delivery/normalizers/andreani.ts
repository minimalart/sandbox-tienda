/**
 * Normalizador Andreani — ÚNICA fuente de verdad del mapeo estadoId → vocabulario
 * interno.
 *
 * Antes este mapeo vivía privado dentro del adapter (providers/andreani/index.ts
 * → mapEstadoIdToStatus). Lo movimos acá para que TANTO el adapter (que decide el
 * target de la state machine en pollStatus) COMO el timeline (que necesita un
 * `code` interno por evento) consuman exactamente el mismo criterio, sin
 * duplicarlo. El adapter ahora reexporta `mapEstadoIdToStatus` desde acá.
 *
 * Dos derivaciones a partir del mismo estadoId:
 *   - mapEstadoIdToStatus → target de la state machine operativa
 *     (DeliveryExecutionStatus | null), usado para transicionar.
 *   - mapEstadoIdToEventCode → `code` interno del TrackingEvent (vocabulario más
 *     fino del timeline, no necesariamente un estado de la máquina).
 *
 *   estadoId  | significado Andreani          | status (máquina) | event code
 *   ----------|-------------------------------|------------------|------------------
 *   < 5       | generado / pend. admisión     | null             | 'created'
 *   5         | admitido (entró a la red)     | picked_up        | 'admitted'
 *   6..17     | en proceso / en tránsito      | in_transit       | 'in_transit'
 *   18        | entregado                     | delivered        | 'delivered'
 */

import type { DeliveryExecutionStatus } from '../types';
import type { TrackingEventCode } from '../tracking-types';

export const ANDREANI_ADMITTED_STATUS_ID = 5;
export const ANDREANI_DELIVERED_STATUS_ID = 18;

/**
 * estadoId Andreani → target de la state machine operativa, o null si no hay
 * transición que aplicar (estado < 5: aún no admitido). Fuente de verdad única;
 * el adapter lo reexporta.
 */
export function mapEstadoIdToStatus(
  estadoId: number,
): DeliveryExecutionStatus | null {
  if (!Number.isFinite(estadoId) || estadoId <= 0) return null;
  if (estadoId === ANDREANI_DELIVERED_STATUS_ID) return 'delivered';
  if (estadoId > ANDREANI_ADMITTED_STATUS_ID) return 'in_transit';
  if (estadoId === ANDREANI_ADMITTED_STATUS_ID) return 'picked_up';
  return null; // < 5: aún no admitido, sin transición operativa.
}

/**
 * estadoId Andreani → `code` interno del TrackingEvent. Vocabulario del timeline,
 * derivado del MISMO threshold que `mapEstadoIdToStatus` (single source of truth).
 * A diferencia de la máquina, acá SÍ registramos los estados previos a la
 * admisión como 'created' (el timeline es append-only y no valida transiciones).
 */
export function mapEstadoIdToEventCode(estadoId: number): TrackingEventCode {
  if (!Number.isFinite(estadoId) || estadoId <= 0) return 'created';
  if (estadoId === ANDREANI_DELIVERED_STATUS_ID) return 'delivered';
  if (estadoId > ANDREANI_ADMITTED_STATUS_ID) return 'in_transit';
  if (estadoId === ANDREANI_ADMITTED_STATUS_ID) return 'admitted';
  return 'created'; // < 5: aún no admitido.
}
