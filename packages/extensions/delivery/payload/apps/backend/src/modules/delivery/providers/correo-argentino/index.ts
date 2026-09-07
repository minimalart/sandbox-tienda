/**
 * CorreoArgentinoDeliveryProvider — adapter del carrier Correo Argentino sobre
 * la abstracción DeliveryProvider.
 *
 * Mismo criterio que el adapter de Andreani: REUSA por import toda la
 * integración viva de `correo-argentino-fulfillment` y el workflow
 * `correo-generate-tickets`. No reimplementa auth, ni el alta del envío, ni la
 * consolidación del bulto.
 *
 * Tres ventajas concretas sobre el adapter de Andreani:
 *  - `pollStatus()` usa el normalizador compartido, que ya distingue "sin
 *    historial" de "estado desconocido" y loguea los `statusId` sin mapear.
 *  - `pollStatusBatch()` existe: `GET /tracking` acepta un ARRAY de tracking
 *    numbers, así que el sync agrupa en vez de hacer una llamada HTTP por envío
 *    (que es lo único que la API de Andreani permite).
 *  - `getLabel()` no necesita URL previa: `POST /labels` devuelve el PDF a
 *    partir del tracking number, así que alcanza con el TN.
 */

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getCorreoPaqarClient } from '../../../correo-argentino-fulfillment/get-client';
import {
  downloadCorreoLabels,
  sanitizeLabelFileName,
  toLabelBuffer,
} from '../../../correo-argentino-fulfillment/label-download';
import { transformCorreoAgencies } from '../../../correo-argentino-fulfillment/transformers/agencies';
import { isCorreoAgencyOperational } from '../../../correo-argentino-fulfillment/transformers/agencies';
import { normalizePostalCode } from '../../../correo-argentino-fulfillment/transformers/province-codes';
import correoGenerateTicketsWorkflow from '../../../../workflows/correo-generate-tickets';
import {
  CORREO_TRACKING_BATCH_SIZE,
  correoTrackingKey,
  pollCorreoTrackingBatched,
  toCorreoStatusUpdate,
} from '../../normalizers/correo-argentino';
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

export class CorreoArgentinoDeliveryProvider extends AbstractDeliveryProvider {
  static identifier = 'correo_argentino';

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
   * La cotización del checkout vive en `calculatePrice()` del provider de
   * fulfillment (MiCorreo `POST /rates`). Duplicarla acá crearía dos precios
   * posibles para el mismo envío según por dónde entre la consulta — que es
   * peor que no tener el método.
   */
  async quote(_ctx: QuoteContext): Promise<Quote> {
    throw new Error(
      'CorreoArgentinoDeliveryProvider.quote no implementado: la cotización vive en el provider de fulfillment correo-argentino-fulfillment (MiCorreo /rates).',
    );
  }

  /**
   * Crea el envío ejecutando `correo-generate-tickets`, que es el único path de
   * alta. El workflow ya es idempotente, así que un reintento del adapter no
   * duplica envíos.
   */
  async createShipment(
    _execution: DeliveryExecutionRecord,
    order: DeliveryOrderRef,
  ): Promise<ShipmentResult> {
    const { result } = await correoGenerateTicketsWorkflow(this.container).run({
      input: { order_id: order.id },
    });

    const ticket = result.ticket;

    return {
      // En Correo el TN ES el identificador del envío: no hay un agrupador de
      // bultos aparte como en Andreani (`parcels[]` toma un solo bulto).
      external_shipment_id: ticket.tracking_number,
      tracking_number: ticket.tracking_number || undefined,
      metadata: {
        delivery_type: ticket.delivery_type,
        service_type: ticket.service_type,
        agency_id: ticket.agency_id ?? null,
        created: result.created,
      },
    };
  }

  /**
   * Materializa el rótulo. A diferencia de Andreani no hace falta una
   * `label_url` previa: `POST /labels` lo genera a partir del tracking number.
   */
  async getLabel(execution: DeliveryExecutionRecord): Promise<Label | null> {
    const trackingNumber =
      execution.tracking_number ?? execution.external_shipment_id ?? undefined;
    if (!trackingNumber) return null;

    const result = await downloadCorreoLabels(this.logger, {
      tracking_numbers: [trackingNumber],
    });

    const label = result.labels[0];
    // Ojo: las fallas parciales de `/labels` vienen con HTTP 200 y
    // `result: "ERROR: ..."`. `null` acá significa "todavía no hay rótulo",
    // que es un estado legítimo, no un error.
    if (!label?.ok || !label.base64) return null;

    return {
      url: execution.label_url ?? '',
      buffer: toLabelBuffer(label.base64),
      content_type: 'application/pdf',
      file_name: sanitizeLabelFileName(
        label.fileName,
        `correo-${trackingNumber}.pdf`,
      ),
    };
  }

  /**
   * Consulta el estado de UN envío. Cumple el contrato del adapter, pero el job
   * de sync NO lo usa: usa `pollStatusBatch`, que agrupa. Queda para los caminos
   * puntuales (admin pidiendo el estado de una ejecución).
   *
   * No proyecta a Medusa: eso lo decide el caller (vía el workflow de
   * transición), que es quien maneja la idempotencia.
   */
  async pollStatus(
    execution: DeliveryExecutionRecord,
  ): Promise<NormalizedStatusUpdate> {
    const trackingNumber = execution.tracking_number ?? undefined;
    if (!trackingNumber) {
      return { status: null };
    }

    const items = await getCorreoPaqarClient(this.logger).getTracking([
      trackingNumber,
    ]);
    const raw = items[0];
    if (!raw) return { status: null };

    // `toCorreoStatusUpdate` delega en el normalizador del módulo de fulfillment,
    // que loguea con `error` todo par statusId+status que no sepa mapear: ese log
    // es el mecanismo para reconstruir la tabla que Correo no publica. No
    // silenciarlo pasando un logger mudo.
    return toCorreoStatusUpdate(raw, this.logger);
  }

  /**
   * Consulta el estado de MUCHOS envíos con la MÍNIMA cantidad de llamadas.
   *
   * Esta es la ventaja concreta de Correo sobre Andreani: `GET /tracking` acepta
   * un array de tracking numbers, así que una página de 200 ejecuciones se
   * resuelve en 8 requests (`CORREO_TRACKING_BATCH_SIZE = 25`) en vez de 200.
   * El job de Andreani hace una llamada HTTP por envío porque su API no ofrece
   * otra cosa; replicar eso acá sería tirar la ventaja a la basura.
   *
   * Devuelve un índice `execution_id → NormalizedStatusUpdate` con SOLO las
   * ejecuciones que tuvieron respuesta con historial. Una ejecución ausente del
   * mapa significa "sin novedad" (o TN inexistente, que Correo devuelve con
   * HTTP 200 y `event: []`), nunca un error.
   */
  async pollStatusBatch(
    executions: ReadonlyArray<DeliveryExecutionRecord>,
    batchSize: number = CORREO_TRACKING_BATCH_SIZE,
  ): Promise<Map<string, NormalizedStatusUpdate>> {
    const withTracking = executions.filter(
      (execution): execution is DeliveryExecutionRecord =>
        Boolean(execution?.id) && Boolean(execution.tracking_number?.trim()),
    );

    if (withTracking.length === 0) return new Map();

    const client = getCorreoPaqarClient(this.logger);
    const byTracking = await pollCorreoTrackingBatched(
      withTracking.map((execution) => execution.tracking_number),
      (batch) => client.getTracking(batch),
      { logger: this.logger, batchSize },
    );

    // TN → ejecución es 1:N (el workflow estampa el mismo TN en todas las
    // ejecuciones de Correo activas de la orden), así que se recorre por
    // ejecución y no por entrada del índice.
    const byExecution = new Map<string, NormalizedStatusUpdate>();
    for (const execution of withTracking) {
      const update = byTracking.get(
        correoTrackingKey(execution.tracking_number as string),
      );
      if (update) byExecution.set(execution.id, update);
    }

    return byExecution;
  }

  /**
   * Sucursales de retiro para un código postal.
   *
   * ⚠️ Según el manual (SIN VERIFICAR contra la API real), `GET /agencies` NO
   * filtra por CP: solo por provincia. Con un CP suelto no se puede deducir la
   * provincia, así que se pide el padrón completo y se filtra en memoria. Es
   * caro — el camino cacheado es la ruta `GET /store/correo-argentino/agencies`,
   * que es la que usa el checkout. Este método existe para completar el contrato
   * del adapter.
   */
  async listPickupPoints(postalCode: string): Promise<Point[]> {
    const normalized = normalizePostalCode(postalCode);
    if (!normalized) return [];

    const raw = await getCorreoPaqarClient(this.logger).getAgencies({});
    const agencies = transformCorreoAgencies(raw)
      .filter(isCorreoAgencyOperational)
      .filter((agency) => agency.address.postal_code === normalized);

    return agencies.map(
      (agency): Point => ({
        id: agency.id,
        description: agency.description,
        address: {
          street: agency.address.street,
          number: agency.address.number,
          city: agency.address.city,
          province: agency.address.province,
          postal_code: agency.address.postal_code,
          country: agency.address.country,
        },
      }),
    );
  }
}

export default CorreoArgentinoDeliveryProvider;
