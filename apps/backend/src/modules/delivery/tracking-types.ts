/**
 * Tipos del timeline unificado de tracking (M4).
 *
 * Separados de types.ts para mantener types.ts enfocado en la state machine
 * operativa y evitar dependencias circulares con el normalizer.
 */

/** Origen de un TrackingEvent. */
export type TrackingEventSource = 'andreani' | 'driver' | 'system';

/**
 * Vocabulario interno normalizado de hitos del timeline. Más fino que la state
 * machine operativa: incluye hitos puramente informativos ('created',
 * 'admitted') que no son estados de la máquina.
 */
export type TrackingEventCode =
  | 'created'
  | 'assigned'
  | 'admitted'
  | 'in_transit'
  | 'at_pickup_point'
  | 'delivered'
  | 'failed_attempt'
  | 'canceled';

/** Coordenadas opcionales de un evento. */
export interface TrackingEventLocation {
  lat: number;
  lng: number;
}

/**
 * Input de ingesta de un TrackingEvent (service.appendTrackingEvent). El service
 * lo dedupea por (delivery_execution_id, external_code, occurred_at).
 */
export interface AppendTrackingEventInput {
  delivery_execution_id: string;
  source: TrackingEventSource;
  code: TrackingEventCode | string;
  external_code?: string | null;
  description?: string | null;
  /** Default: now. */
  occurred_at?: Date | string;
  location?: TrackingEventLocation | null;
  raw?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** Forma de un evento en la respuesta del endpoint de timeline. */
export interface TimelineEvent {
  code: string;
  source: string;
  description: string | null;
  occurred_at: string | null;
  location: TrackingEventLocation | null;
}
