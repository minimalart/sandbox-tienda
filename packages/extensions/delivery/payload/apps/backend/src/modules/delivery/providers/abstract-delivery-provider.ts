/**
 * AbstractDeliveryProvider — contrato base de un ejecutor de entregas.
 *
 * Cada provider concreto (Andreani, flota propia, retiro en tienda) extiende
 * esta clase y declara su `identifier` estático (= provider_type del sidecar).
 *
 * Reglas no negociables:
 *  - El provider NUNCA escribe a Medusa (no llama createOrderShipmentWorkflow ni
 *    markFulfillmentAsDeliveredWorkflow). Solo devuelve estado NORMALIZADO.
 *  - La proyección comercial vive en el workflow `transition-delivery-execution`.
 *  - El provider obtiene sus dependencias del container que recibe en el ctor
 *    (inyectado por el registry).
 */

import type {
  AssignParams,
  DeliveryExecutionRecord,
  DeliveryOrderRef,
  DeliveryProviderContext,
  Label,
  NormalizedStatusUpdate,
  Point,
  Quote,
  QuoteContext,
  ShipmentResult,
} from './types';

export abstract class AbstractDeliveryProvider {
  /**
   * Identificador del provider. DEBE coincidir con `provider_type` de la
   * DeliveryExecution ('andreani' | 'own_fleet' | 'store_pickup').
   */
  static identifier: string;

  protected readonly context: DeliveryProviderContext;

  constructor(context: DeliveryProviderContext) {
    this.context = context;
  }

  /** Resuelve el identifier de la instancia desde la clase concreta. */
  getIdentifier(): string {
    return (this.constructor as typeof AbstractDeliveryProvider).identifier;
  }

  /** Cotiza un servicio de entrega para el contexto dado. */
  abstract quote(ctx: QuoteContext): Promise<Quote>;

  /**
   * Crea el envío en el carrier para una ejecución/orden. Devuelve el id del
   * envío externo + tracking + label.
   */
  abstract createShipment(
    execution: DeliveryExecutionRecord,
    order: DeliveryOrderRef,
  ): Promise<ShipmentResult>;

  /** Resuelve la etiqueta del envío, o null si no hay. */
  abstract getLabel(
    execution: DeliveryExecutionRecord,
  ): Promise<Label | null>;

  /**
   * Consulta el estado en el carrier y devuelve un update NORMALIZADO (target
   * de la state machine + eventos). NO proyecta a Medusa.
   */
  abstract pollStatus(
    execution: DeliveryExecutionRecord,
  ): Promise<NormalizedStatusUpdate>;

  /** Asigna un repartidor/vehículo (flota propia). Opcional. */
  assign?(
    execution: DeliveryExecutionRecord,
    params: AssignParams,
  ): Promise<void>;

  /** Lista puntos de retiro para un código postal (Andreani). Opcional. */
  listPickupPoints?(postalCode: string): Promise<Point[]>;
}

export default AbstractDeliveryProvider;
