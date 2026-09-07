/**
 * AndreaniDeliveryProvider — adapter del carrier Andreani sobre la abstracción
 * DeliveryProvider.
 *
 * REUSA por import toda la integración viva de `andreani-fulfillment` y el
 * workflow `andreani-generate-tickets`. NO reimplementa auth, ni el POST de
 * creación de envío, ni el packing de bultos.
 *
 * Estrategia de createShipment:
 *  - Ejecuta `andreaniGenerateTicketsWorkflow.run({ input: { order_id } })`, que
 *    es el ÚNICO path de creación de envío Andreani (valida orden → packIntoBoxes
 *    → client.createShipment → guarda ticket en order.metadata). El adapter solo
 *    mapea su resultado al ShipmentResult. Cero duplicación del POST.
 *
 * pollStatus:
 *  - Mueve acá la consulta de estado que vivía inline en el job
 *    `sync-andreani-tracking-status`, pero en vez de proyectar a Medusa devuelve
 *    un NormalizedStatusUpdate con el target de la state machine operativa.
 */

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  getAndreaniClient,
  getAndreaniTransformer,
} from '../../../andreani-fulfillment/get-client';
import {
  downloadAndreaniLabel,
  type AndreaniLabelDownloadInput,
} from '../../../andreani-fulfillment/label-download';
import andreaniGenerateTicketsWorkflow from '../../../../workflows/andreani-generate-tickets';
import { AbstractDeliveryProvider } from '../abstract-delivery-provider';
import type {
  DeliveryExecutionRecord,
  DeliveryOrderRef,
  DeliveryProviderContext,
  Label,
  NormalizedStatusUpdate,
  Point,
  Quote,
  QuoteContext,
  ShipmentResult,
} from '../types';
// Mapeo estadoId → status: ÚNICA fuente de verdad, vive en el normalizer del
// módulo y se reusa acá (antes estaba duplicado inline). El timeline (workflow)
// consume el MISMO normalizer para derivar el `code` del evento.
import { mapEstadoIdToStatus } from '../../normalizers/andreani';

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

export class AndreaniDeliveryProvider extends AbstractDeliveryProvider {
  static identifier = 'andreani';

  private get container(): MedusaContainer {
    return this.context.container;
  }

  private get logger(): Logger {
    return this.container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  }

  constructor(context: DeliveryProviderContext) {
    super(context);
  }

  /**
   * Cotización. Reusa el client por ENV. Stub conservador: Andreani cotiza por
   * el endpoint /v1/tarifas (client.getTarifas), pero la cotización de checkout
   * vive HOY en el provider de fulfillment andreani-fulfillment y NO debe
   * duplicarse acá. Se deja como TODO para no tocar ese flujo.
   */
  async quote(_ctx: QuoteContext): Promise<Quote> {
    // TODO(M2+): si se necesita cotizar desde la capa delivery, reusar
    // client.getTarifas con el box-packer. Por ahora la cotización de checkout
    // es responsabilidad exclusiva del provider de fulfillment andreani.
    throw new Error(
      'AndreaniDeliveryProvider.quote no implementado: la cotización vive en el provider de fulfillment andreani-fulfillment.',
    );
  }

  /**
   * Crea el envío Andreani ejecutando el workflow `andreani-generate-tickets`
   * (único path de creación). Mapea su ticket al ShipmentResult.
   */
  async createShipment(
    _execution: DeliveryExecutionRecord,
    order: DeliveryOrderRef,
  ): Promise<ShipmentResult> {
    const { result } = await andreaniGenerateTicketsWorkflow(
      this.container,
    ).run({
      input: { order_id: order.id },
    });

    const ticket = result.ticket;

    return {
      external_shipment_id: ticket.andreani_order_id,
      tracking_number: ticket.tracking_number || undefined,
      label_url: ticket.grouped_label_url || undefined,
      metadata: {
        service_type: ticket.service_type,
        contract: ticket.contract,
        boxes_summary: ticket.boxes_summary,
        bultos: ticket.bultos,
      },
    };
  }

  /**
   * Resuelve y materializa la etiqueta del envío reusando label-download.
   * Devuelve null si la ejecución no tiene aún envío/etiqueta.
   */
  async getLabel(
    execution: DeliveryExecutionRecord,
  ): Promise<Label | null> {
    const shipmentId = execution.external_shipment_id ?? undefined;
    const labelUrl = execution.label_url ?? undefined;
    if (!shipmentId && !labelUrl) return null;

    const input: AndreaniLabelDownloadInput = {
      shipment_id: shipmentId ?? undefined,
      label_url: labelUrl ?? undefined,
      tracking_number: execution.tracking_number ?? undefined,
    };

    const result = await downloadAndreaniLabel(this.logger, input);

    return {
      url: labelUrl ?? '',
      buffer: result.buffer,
      content_type: result.content_type,
      file_name: result.file_name,
    };
  }

  /**
   * Consulta el estado en Andreani y devuelve el target de la state machine.
   * Mueve acá la lógica que vivía inline en sync-andreani-tracking-status.
   *
   * No proyecta a Medusa: el caller (job → transition-delivery-execution
   * workflow) decide si proyecta y maneja la idempotencia.
   */
  async pollStatus(
    execution: DeliveryExecutionRecord,
  ): Promise<NormalizedStatusUpdate> {
    const tracking = execution.tracking_number ?? undefined;

    // Sin tracking utilizable → no hay nada que consultar.
    if (!tracking || tracking.startsWith('PENDING')) {
      return { status: null };
    }

    const client = getAndreaniClient(this.logger);
    const status = await client.getShipment(tracking);
    const estadoId = Number(status.estadoId) || 0;

    const target = mapEstadoIdToStatus(estadoId);

    return {
      status: target,
      raw_status: estadoId,
      events: [
        {
          timestamp: new Date().toISOString(),
          raw_status: String(estadoId),
          description: getString(status as UnknownRecord, 'estado'),
        },
      ],
    };
  }

  /**
   * Lista Puntos de Tercero (HOP) para un código postal. Reusa exactamente lo
   * que usa la route store/andreani/hop-points (client + transformer por ENV).
   */
  async listPickupPoints(postalCode: string): Promise<Point[]> {
    const client = getAndreaniClient(this.logger);
    const transformer = getAndreaniTransformer();
    const raw = await client.getPuntosDeTercero(postalCode);
    return transformer.transformPickupLocations(raw);
  }
}

export default AndreaniDeliveryProvider;
