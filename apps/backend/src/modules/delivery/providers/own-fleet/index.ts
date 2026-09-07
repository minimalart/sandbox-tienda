/**
 * OwnFleetDeliveryProvider — adapter de flota propia (own_fleet).
 *
 * A diferencia de Andreani, NO hay carrier externo: no se llama ninguna API de
 * terceros. El recorrido lo mueven las acciones del repartidor desde la PWA
 * (workflow driver-delivery-action → transition-delivery-execution), no un poll.
 *
 * Responsabilidades del adapter:
 *  - createShipment: genera un external_shipment_id interno ('OF-'+id). Sin
 *    tracking de carrier ni label real.
 *  - quote: estimación INTERNA (no checkout) por zona (pricing_tier/sla_hours)
 *    con defaults razonables. No muta orders ni payments.
 *  - getLabel: devuelve un MANIFEST/REMITO interno estructurado (sin PDF) con
 *    execution id, order display_id, dirección y driver asignado.
 *  - pollStatus: no-op (status undefined) — el estado avanza por las acciones del
 *    driver, no por poll. Documentado abajo.
 *  - assign: valida driver/vehicle activos y persiste la asignación en la
 *    DeliveryExecution. NO proyecta a Medusa (assigned no es hito comercial).
 *
 * Igual que todos los providers: NUNCA proyecta a Medusa. La proyección vive en
 * transition-delivery-execution.
 */

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../types';
import type DeliveryModuleService from '../../service';
import { AbstractDeliveryProvider } from '../abstract-delivery-provider';
import type {
  AssignParams,
  DeliveryExecutionRecord,
  DeliveryOrderRef,
  DeliveryProviderContext,
  Label,
  NormalizedStatusUpdate,
  Quote,
  QuoteContext,
  ShipmentResult,
} from '../types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getMetaString = (
  meta: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

/**
 * Tabla de precio base por pricing_tier para la ESTIMACIÓN interna de flota
 * propia (en la unidad menor de la moneda). No es la tarifa de checkout; es un
 * costeo operativo aproximado. Ajustable sin migración (es código, no dato).
 */
const OWN_FLEET_TIER_PRICING: Record<string, number> = {
  urbana: 80000,
  extendida: 150000,
};

/** Estimación default cuando no hay zona / pricing_tier resuelto. */
const OWN_FLEET_DEFAULT_AMOUNT = 120000;
/** ETA default (días hábiles) cuando la zona no informa SLA. */
const OWN_FLEET_DEFAULT_ESTIMATED_DAYS = 1;
/** Moneda default de la estimación (no hay currency en QuoteContext). */
const DEFAULT_CURRENCY_CODE = 'ars';

export class OwnFleetDeliveryProvider extends AbstractDeliveryProvider {
  static identifier = 'own_fleet';

  private get container(): MedusaContainer {
    return this.context.container;
  }

  private get logger(): Logger {
    return this.container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  }

  private get service(): DeliveryModuleService {
    return this.container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
  }

  constructor(context: DeliveryProviderContext) {
    super(context);
  }

  /**
   * Cotización ESTIMATIVA de flota propia (uso interno).
   *
   * No hay carrier externo: la estimación es propia, derivada de la zona cuando
   * está disponible (precio base por `pricing_tier`, ETA por `sla_hours`) y de
   * defaults razonables si no hay zona.
   *
   * ALCANCE: este quote NO se conecta al checkout. El precio que paga el cliente
   * lo resuelven las shipping options nativas / el fulfillment provider de
   * Andreani vía su `calculatePrice`. Este método es para uso INTERNO/FUTURO de
   * la capa delivery (planificación de costos, comparativas, etc.). No mutar
   * orders ni payments con su resultado.
   *
   * Resolución de zona: si `ctx.metadata.zone_id` viene, se usa esa zona
   * directamente (el caller ya resolvió el punto→zona vía store-location, que es
   * dueño de la geometría — este provider NO reimplementa point-in-polygon).
   * Sin zone_id, devuelve la estimación default.
   */
  async quote(ctx: QuoteContext): Promise<Quote> {
    const currencyCode = getMetaString(ctx.metadata, 'currency_code') ?? DEFAULT_CURRENCY_CODE;
    const zoneId = getMetaString(ctx.metadata, 'zone_id');

    let pricingTier: string | null = null;
    let slaHours: number | null = null;

    if (zoneId) {
      const zone = (await this.service
        .retrieveDeliveryZone(zoneId)
        .catch(() => null)) as UnknownRecord | null;
      if (zone && zone.active !== false) {
        pricingTier =
          typeof zone.pricing_tier === 'string' ? zone.pricing_tier : null;
        slaHours =
          typeof zone.sla_hours === 'number' ? zone.sla_hours : null;
      }
    }

    const amount = pricingTier
      ? OWN_FLEET_TIER_PRICING[pricingTier] ?? OWN_FLEET_DEFAULT_AMOUNT
      : OWN_FLEET_DEFAULT_AMOUNT;

    // ETA: SLA en horas → días hábiles redondeados hacia arriba (mín. 1).
    const estimatedDays =
      typeof slaHours === 'number' && slaHours > 0
        ? Math.max(1, Math.ceil(slaHours / 24))
        : OWN_FLEET_DEFAULT_ESTIMATED_DAYS;

    return {
      amount,
      currency_code: currencyCode,
      estimated_days: estimatedDays,
      service_mode: ctx.service_mode ?? 'home_delivery',
      metadata: {
        internal: true,
        provider: 'own_fleet',
        estimate: true,
        zone_id: zoneId ?? null,
        pricing_tier: pricingTier,
        sla_hours: slaHours,
      },
    };
  }

  /**
   * "Crea el envío" para flota propia: no hay carrier, así que solo genera un
   * external_shipment_id interno determinístico ('OF-'+execution.id). Sin
   * tracking_number ni label_url de carrier.
   */
  async createShipment(
    execution: DeliveryExecutionRecord,
    _order: DeliveryOrderRef,
  ): Promise<ShipmentResult> {
    return {
      external_shipment_id: `OF-${execution.id}`,
      metadata: { internal: true, provider: 'own_fleet' },
    };
  }

  /**
   * "Etiqueta" de flota propia: NO hay etiqueta de carrier. En su lugar
   * devolvemos un MANIFEST / REMITO interno como datos estructurados (no PDF).
   *
   * Contenido del manifest: id de la ejecución, display_id de la order (resuelto
   * vía el link delivery_execution↔order con query.graph, igual que el GET de
   * detalle), dirección de entrega y driver asignado.
   *
   * ALCANCE de esta iteración:
   *  - NO se genera PDF ni se sube a storage: el tipo Label exige `url`, así que
   *    devolvemos `url: ''` (sin archivo) y embebemos el manifest estructurado
   *    en `metadata`. El consumidor que quiera mostrar/imprimir el remito usa
   *    esos campos.
   *  - TODO(post-Y3): materializar el remito en PDF (a un storage real) y
   *    poblar `url`/`buffer`. Queda pendiente a propósito.
   */
  async getLabel(execution: DeliveryExecutionRecord): Promise<Label | null> {
    const query = this.container.resolve(ContainerRegistrationKeys.QUERY);

    // Order linkeada (read-only) vía el link delivery_execution↔order.
    let orderDisplayId: number | string | null = null;
    let address: UnknownRecord | null = null;
    try {
      const { data: executions } = await query.graph({
        entity: 'delivery_execution',
        fields: [
          'id',
          'order.display_id',
          'order.email',
          'order.shipping_address.first_name',
          'order.shipping_address.last_name',
          'order.shipping_address.address_1',
          'order.shipping_address.city',
          'order.shipping_address.postal_code',
          'order.shipping_address.phone',
        ],
        filters: { id: execution.id },
      });
      const record = (executions ?? [])[0] as UnknownRecord | undefined;
      const order = isRecord(record?.order) ? record!.order : undefined;
      if (order) {
        const displayId = order.display_id;
        orderDisplayId =
          typeof displayId === 'number' || typeof displayId === 'string'
            ? displayId
            : null;
        address = isRecord(order.shipping_address)
          ? order.shipping_address
          : null;
      }
    } catch {
      // Sin order resoluble (link ausente / orden borrada): el manifest se
      // devuelve igual con los datos del sidecar.
    }

    const manifest = {
      type: 'own_fleet_manifest' as const,
      execution_id: execution.id,
      order_display_id: orderDisplayId,
      driver_id: execution.driver_id ?? null,
      vehicle_id: execution.vehicle_id ?? null,
      shipping_address: address
        ? {
            first_name: address.first_name ?? null,
            last_name: address.last_name ?? null,
            address_1: address.address_1 ?? null,
            city: address.city ?? null,
            postal_code: address.postal_code ?? null,
            phone: address.phone ?? null,
          }
        : null,
      generated_at: new Date().toISOString(),
    };

    return {
      // Sin PDF en esta iteración (ver alcance arriba): el manifest va en metadata.
      url: '',
      content_type: 'application/json',
      file_name: `manifest-${execution.id}.json`,
      metadata: manifest,
    };
  }

  /**
   * Para own_fleet NO hay poll de carrier: el estado lo mueven las acciones del
   * repartidor (pickup / in_transit / delivered / failed_attempt) vía el
   * workflow driver-delivery-action. Por eso devolvemos un update sin cambios
   * (status null). El job de tracking que recorre ejecuciones puede llamar este
   * pollStatus sin efecto, y el avance real viene por las acciones del driver.
   */
  async pollStatus(
    _execution: DeliveryExecutionRecord,
  ): Promise<NormalizedStatusUpdate> {
    return { status: null };
  }

  /**
   * Asigna driver (+ vehicle opcional) a una ejecución de flota propia.
   *
   * Valida que driver/vehicle existan y estén activos, persiste driver_id /
   * vehicle_id en la DeliveryExecution. NO proyecta a Medusa ni transiciona el
   * status: 'assigned' no es un hito comercial. La transición de status la
   * dispara el workflow assign-delivery (que llama este método y luego mueve el
   * estado vía transition-delivery-execution).
   */
  async assign(
    execution: DeliveryExecutionRecord,
    params: AssignParams,
  ): Promise<void> {
    const service = this.service;

    const driver = (await service
      .retrieveDriver(params.driverId)
      .catch(() => null)) as UnknownRecord | null;
    if (!driver) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Driver '${params.driverId}' no existe.`,
      );
    }
    if (driver.active === false) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Driver '${params.driverId}' está inactivo.`,
      );
    }

    if (params.vehicleId) {
      const vehicle = (await service
        .retrieveVehicle(params.vehicleId)
        .catch(() => null)) as UnknownRecord | null;
      if (!vehicle) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Vehicle '${params.vehicleId}' no existe.`,
        );
      }
      if (vehicle.active === false) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Vehicle '${params.vehicleId}' está inactivo.`,
        );
      }
    }

    await service.updateDeliveryExecutions({
      id: execution.id,
      driver_id: params.driverId,
      vehicle_id: params.vehicleId ?? null,
    });

    this.logger.info(
      `[own_fleet] DeliveryExecution ${execution.id} asignada a driver ${params.driverId}${
        params.vehicleId ? ` / vehicle ${params.vehicleId}` : ''
      }.`,
    );
  }
}

export default OwnFleetDeliveryProvider;
