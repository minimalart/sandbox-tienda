import {
  DELIVERY_TERMINAL_STATUSES as TERMINAL,
  type DeliveryExecutionStatus,
  type DeliveryProviderType,
  type DeliveryServiceMode,
} from './types';

/**
 * Listas planas de valores conocidos para las agregaciones de analytics (M9).
 *
 * Las mantenemos acá (y no en types.ts) para no contaminar el dominio con
 * arrays de presentación; se usan solo para garantizar que el breakdown por
 * status/provider/service_mode incluya todas las claves con 0 cuando no haya
 * filas, dándole estabilidad a la UI del Control Tower.
 */
export const DELIVERY_STATUSES: readonly DeliveryExecutionStatus[] = [
  'pending',
  'ready',
  'assigned',
  'picked_up',
  'in_transit',
  'at_pickup_point',
  'delivered',
  'failed_attempt',
  'canceled',
];

export const DELIVERY_PROVIDER_TYPES: readonly DeliveryProviderType[] = [
  'andreani',
  'own_fleet',
  'store_pickup',
];

export const DELIVERY_SERVICE_MODES: readonly DeliveryServiceMode[] = [
  'home_delivery',
  'hop',
  'branch_pickup',
  'store_pickup',
];

/** Re-export para que analytics.ts no importe de types.ts directamente. */
export const DELIVERY_TERMINAL_STATUSES: readonly DeliveryExecutionStatus[] = TERMINAL;
