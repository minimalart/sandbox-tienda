/**
 * Contratos de la abstracción DeliveryProvider.
 *
 * Un DeliveryProvider encapsula la integración con un ejecutor físico de
 * entregas (Andreani, flota propia, retiro en tienda). Es la frontera entre la
 * capa operativa (DeliveryExecution, sidecar) y el mundo exterior (carrier API,
 * app de repartidores, etc.).
 *
 * REGLA: el provider NUNCA proyecta a Medusa. Devuelve estado NORMALIZADO
 * (targets de la state machine operativa). La proyección al estado comercial
 * de Medusa (shipped/delivered) vive EXCLUSIVAMENTE en el workflow
 * `transition-delivery-execution`, vía los workflows core.
 */

import type { DeliveryExecutionStatus } from '../types';

/** Registro de DeliveryExecution tal como lo devuelve el service. */
export interface DeliveryExecutionRecord {
  id: string;
  provider_type: string;
  service_mode: string;
  status: string;
  external_shipment_id?: string | null;
  tracking_number?: string | null;
  label_url?: string | null;
  attempt_count: number;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** Vista mínima de la Order necesaria para crear un envío. */
export interface DeliveryOrderRef {
  id: string;
  [key: string]: unknown;
}

/**
 * Contexto que el registry inyecta al construir un provider. El container
 * permite al adapter resolver sus dependencias (Andreani client por ENV,
 * query.graph, logger) y ejecutar workflows core/de dominio.
 */
export interface DeliveryProviderContext {
  /** Container de Medusa para resolver servicios y ejecutar workflows. */
  container: import('@medusajs/framework/types').MedusaContainer;
}

/** Cotización de un servicio de entrega. */
export interface Quote {
  /** Precio en la unidad menor de la moneda (centavos). */
  amount: number;
  currency_code: string;
  /** Plazo estimado en días hábiles, si el carrier lo informa. */
  estimated_days?: number;
  service_mode?: string;
  metadata?: Record<string, unknown>;
}

/** Resultado de crear un envío en el carrier. */
export interface ShipmentResult {
  /** Id del envío en el carrier (ej. Andreani agrupadorDeBultos). */
  external_shipment_id: string;
  tracking_number?: string;
  label_url?: string;
  metadata?: Record<string, unknown>;
}

/** Etiqueta de un envío. */
export interface Label {
  /** URL de la etiqueta (PDF) en el carrier. Vacío si no hay archivo aún. */
  url: string;
  /** PDF como buffer, si el provider lo materializa. */
  buffer?: Buffer;
  content_type?: string;
  file_name?: string;
  /**
   * Datos estructurados de la etiqueta. Usado por flota propia para embeber el
   * MANIFEST/REMITO interno cuando no hay PDF de carrier (ver
   * OwnFleetDeliveryProvider.getLabel).
   */
  metadata?: Record<string, unknown>;
}

/** Evento operativo normalizado de un envío. */
export interface NormalizedEvent {
  timestamp?: string;
  /** Código/estado crudo del carrier (ej. estadoId Andreani). */
  raw_status?: string;
  description?: string;
  location?: string;
}

/**
 * Update normalizado que devuelve `pollStatus`. El provider NO proyecta a
 * Medusa: solo traduce el estado del carrier al target de la state machine
 * operativa. El workflow `transition-delivery-execution` decide si proyecta.
 */
export interface NormalizedStatusUpdate {
  /**
   * Estado destino de la state machine operativa, o null si no hay transición
   * que aplicar (estado sin cambios / no mapeable).
   */
  status: DeliveryExecutionStatus | null;
  events?: NormalizedEvent[];
  /** Código crudo del carrier que originó el mapeo (debug/trazabilidad). */
  raw_status?: string | number;
}

/** Punto de retiro (sucursal / HOP). */
export interface Point {
  id: string;
  description: string;
  address: {
    street: string;
    number: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
  };
}

/** Contexto para cotizar (postal code + bultos/peso). */
export interface QuoteContext {
  postal_code: string;
  service_mode?: string;
  items?: Array<{
    quantity: number;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    unit_price?: number;
  }>;
  metadata?: Record<string, unknown>;
}

/** Parámetros de asignación (flota propia). */
export interface AssignParams {
  driverId: string;
  vehicleId?: string;
}
