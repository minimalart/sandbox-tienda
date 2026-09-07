/**
 * transition-delivery-execution — ÚNICO punto donde el sidecar proyecta al
 * estado comercial de Medusa.
 *
 * Step 1: aplica la transición operativa (service.transition): valida contra la
 *         state machine, sella timestamps operativos, appendea el evento.
 * Step 2 (condicional + idempotente): si el nuevo estado cruza un hito comercial
 *         proyecta a Medusa vía los workflows CORE, resolviendo el fulfillment
 *         linkeado por query.graph:
 *           - cruza a picked_up / in_transit  → createOrderShipmentWorkflow
 *             (solo si el fulfillment NO tiene shipped_at)
 *           - delivered                       → markFulfillmentAsDeliveredWorkflow
 *             (solo si el fulfillment NO tiene delivered_at)
 *
 * El Fulfillment de Medusa sigue siendo la fuente de verdad comercial: la
 * idempotencia se decide leyendo shipped_at / delivered_at del fulfillment ANTES
 * de proyectar (mismo criterio que el job de tracking legacy).
 *
 * El service NUNCA proyecta: ver el comentario en delivery/service.ts → quien
 * quiera proyectar usa ESTE workflow.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  createOrderShipmentWorkflow,
  markFulfillmentAsDeliveredWorkflow,
} from '@medusajs/core-flows';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import type { DeliveryExecutionStatus } from '../modules/delivery/types';
import { mapEstadoIdToEventCode } from '../modules/delivery/normalizers/andreani';
import { buildAndreaniTrackingUrl } from '../modules/andreani-fulfillment/utils/tracking-url';
import type {
  TrackingEventSource,
  TrackingEventCode,
  TrackingEventLocation,
} from '../modules/delivery/tracking-types';

export interface TransitionDeliveryExecutionInput {
  execution_id: string;
  to_status: DeliveryExecutionStatus | string;
  /** Evento crudo del carrier (opcional, se appendea al sidecar). */
  event?: unknown;
}

/**
 * Estados operativos que, al alcanzarse, implican "el paquete salió" → se
 * proyecta `createOrderShipmentWorkflow` (shipped) si aún no estaba enviado.
 */
const SHIPPED_PROJECTION_STATUSES = new Set<string>([
  'picked_up',
  'in_transit',
  'at_pickup_point',
]);

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

/**
 * Normaliza una geolocalización { lat, lng } opcional del evento. Devuelve null
 * si falta o no es válida (no rompe el append).
 */
const parseLocation = (
  value: unknown,
): TrackingEventLocation | null => {
  if (!isRecord(value)) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

// --- Step 1: transición operativa ---

const applyOperationalTransitionStep = createStep(
  'apply-operational-transition',
  async (input: TransitionDeliveryExecutionInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const record = await service.transition(input.execution_id, input.to_status, {
      event: input.event,
    });
    return new StepResponse({
      execution_id: record.id,
      status: record.status as string,
    });
  },
);

// --- Step 1b: append al timeline unificado ---

/**
 * Mapea el `code` interno del evento a la fuente. Por ahora todas las
 * transiciones que llegan acá con un estadoId crudo vienen de Andreani; sin
 * estadoId (transición manual / driver / sistema) usamos `code === to_status` y
 * source 'system' salvo que el event declare otra cosa.
 */
const VALID_TRACKING_SOURCES = new Set<string>(['andreani', 'driver', 'system']);

/**
 * Normaliza `input.event` (forma libre del caller) a un AppendTrackingEventInput.
 * Cubre dos casos:
 *  - Andreani (job sync): event = { source, raw_status: estadoId, events: [...] }.
 *    → external_code = String(estadoId), code = mapEstadoIdToEventCode(estadoId),
 *      occurred_at / description / location del primer NormalizedEvent.
 *  - Manual / driver / system: sin raw_status → code = to_status, source según
 *    event.source (default 'system'), occurred_at = now.
 */
const appendTimelineEventStep = createStep(
  'append-timeline-event',
  async (
    input: {
      execution_id: string;
      to_status: string;
      event?: unknown;
    },
    { container },
  ) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const event = isRecord(input.event) ? input.event : undefined;

    // Origen declarado por el caller; default 'system'.
    const declaredSource = getString(event, 'source');
    const source: TrackingEventSource =
      declaredSource === 'andreani' ||
      declaredSource === 'driver' ||
      declaredSource === 'system'
        ? declaredSource
        : declaredSource === 'andreani-tracking-sync'
          ? 'andreani'
          : VALID_TRACKING_SOURCES.has(declaredSource ?? '')
            ? (declaredSource as TrackingEventSource)
            : 'system';

    // ¿Trae estadoId crudo de Andreani?
    const rawStatusRaw = event?.raw_status;
    const estadoId =
      typeof rawStatusRaw === 'number'
        ? rawStatusRaw
        : typeof rawStatusRaw === 'string'
          ? Number(rawStatusRaw)
          : NaN;
    const hasEstadoId = Number.isFinite(estadoId) && estadoId > 0;

    // Primer NormalizedEvent del carrier (si vino).
    const carrierEvents = Array.isArray(event?.events)
      ? (event!.events as UnknownRecord[])
      : [];
    const first = carrierEvents[0];

    const occurredAt = getString(first, 'timestamp');
    const description =
      getString(first, 'description') ?? getString(event, 'description');

    // Para eventos genéricos (driver/system) el caller puede declarar:
    //  - `code` explícito (ej. 'failed_attempt' vs el to_status 'in_transit'),
    //  - `location` { lat, lng } (geo del repartidor al ejecutar la acción).
    // Andreani nunca trae estos; allí mandan estadoId / events del carrier.
    const declaredCode = getString(event, 'code');
    const location = parseLocation(event?.location);

    const code: TrackingEventCode | string = hasEstadoId
      ? mapEstadoIdToEventCode(estadoId)
      : (declaredCode ?? (input.to_status as TrackingEventCode));

    const externalCode = hasEstadoId
      ? String(estadoId)
      : getString(first, 'raw_status') ?? null;

    const record = await service.appendTrackingEvent({
      delivery_execution_id: input.execution_id,
      source,
      code,
      external_code: externalCode,
      description: description ?? null,
      occurred_at: occurredAt,
      location,
      raw: event ?? null,
    });

    return new StepResponse({ tracking_event_id: record.id });
  },
);

interface ProjectionContext {
  to_status: string;
  fulfillment_id: string | null;
  order_id: string | null;
  /** Ya enviado en Medusa (idempotencia shipped). */
  already_shipped: boolean;
  /** Ya entregado en Medusa (idempotencia delivered). */
  already_delivered: boolean;
  /** items del fulfillment para createOrderShipmentWorkflow. */
  items: Array<{ id: string; quantity: number }>;
  tracking_number?: string;
  /** Provider de la ejecución (andreani | own_fleet | store_pickup). */
  provider_type: string | null;
  /** Driver/vehicle asignados (solo own_fleet; null en el resto). */
  driver_id: string | null;
  vehicle_id: string | null;
}

/**
 * Resuelve el fulfillment linkeado a la ejecución (vía query.graph por el link)
 * y lee shipped_at / delivered_at ANTES de proyectar, para decidir idempotencia.
 */
const resolveProjectionContextStep = createStep(
  'resolve-projection-context',
  async (
    input: { execution_id: string; to_status: string },
    { container },
  ) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: executions } = await query.graph({
      entity: 'delivery_execution',
      fields: [
        'id',
        'tracking_number',
        'provider_type',
        'driver_id',
        'vehicle_id',
        'fulfillment.id',
        'fulfillment.shipped_at',
        'fulfillment.delivered_at',
        'fulfillment.canceled_at',
        'fulfillment.order_id',
        'fulfillment.order.id',
        'fulfillment.items.line_item_id',
        'fulfillment.items.quantity',
      ],
      filters: { id: input.execution_id },
    });

    const execution = executions?.[0] as UnknownRecord | undefined;
    const fulfillment = isRecord(execution?.fulfillment)
      ? (execution!.fulfillment as UnknownRecord)
      : undefined;

    const fulfillmentId = getString(fulfillment, 'id') ?? null;
    const order = isRecord(fulfillment?.order)
      ? (fulfillment!.order as UnknownRecord)
      : undefined;
    const orderId =
      getString(order, 'id') ?? getString(fulfillment, 'order_id') ?? null;

    const items = Array.isArray(fulfillment?.items)
      ? (fulfillment!.items as UnknownRecord[])
          .filter((i) => getString(i, 'line_item_id'))
          .map((i) => ({
            id: getString(i, 'line_item_id') as string,
            quantity: Number(i.quantity) || 1,
          }))
      : [];

    const ctx: ProjectionContext = {
      to_status: input.to_status,
      fulfillment_id: fulfillmentId,
      order_id: orderId,
      already_shipped: Boolean(fulfillment?.shipped_at),
      already_delivered: Boolean(fulfillment?.delivered_at),
      items,
      tracking_number: getString(execution, 'tracking_number'),
      provider_type: getString(execution, 'provider_type') ?? null,
      driver_id: getString(execution, 'driver_id') ?? null,
      vehicle_id: getString(execution, 'vehicle_id') ?? null,
    };

    return new StepResponse(ctx);
  },
);

// --- Step: emitir evento de dominio para el WhatsApp de flota propia ---

/**
 * Emite `delivery.own_fleet_out_for_delivery` con `{ order_id, driver_id,
 * vehicle_id }` cuando una ejecución de flota propia sale a reparto (primera vez
 * que cruza a un SHIPPED_PROJECTION_STATUS). Lo consume el subscriber que manda
 * el WhatsApp "en camino" con datos del repartidor.
 *
 * El guard de idempotencia (primera vez) vive en el `when` del workflow, que
 * reusa la misma señal que la proyección shipped (`!already_shipped`, leído del
 * fulfillment ANTES de proyectar). Acá solo se emite.
 *
 * Best-effort/no-fatal: un fallo del event bus (o aguas abajo, WhatsApp) NO debe
 * romper la transición. Sin compensación: nada que revertir.
 */
const emitOwnFleetOutForDeliveryStep = createStep(
  'emit-own-fleet-out-for-delivery',
  async (
    input: {
      order_id: string;
      driver_id: string | null;
      vehicle_id: string | null;
    },
    { container },
  ) => {
    const logger = container.resolve('logger');
    try {
      const eventBus = container.resolve(Modules.EVENT_BUS);
      await eventBus.emit({
        name: 'delivery.own_fleet_out_for_delivery',
        data: {
          order_id: input.order_id,
          driver_id: input.driver_id,
          vehicle_id: input.vehicle_id,
        },
      });
      logger.info(
        `[transition-delivery-execution] Evento delivery.own_fleet_out_for_delivery emitido para orden ${input.order_id} (driver ${input.driver_id ?? '—'}, vehicle ${input.vehicle_id ?? '—'})`,
      );
      return new StepResponse({ emitted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `[transition-delivery-execution] No se pudo emitir delivery.own_fleet_out_for_delivery para la orden ${input.order_id} (la transición se aplicó OK): ${message}`,
      );
      return new StepResponse({ emitted: false });
    }
  },
);

// --- Workflow ---

export const transitionDeliveryExecutionWorkflow = createWorkflow(
  'transition-delivery-execution',
  (input: TransitionDeliveryExecutionInput) => {
    // 1) Transición operativa (valida + sella timestamps).
    const transitioned = applyOperationalTransitionStep(input);

    // 1b) Append al timeline unificado (idempotente por dedupe en el service).
    const timelineInput = transform(
      { transitioned, input },
      ({ transitioned, input }) => ({
        execution_id: transitioned.execution_id,
        to_status: input.to_status as string,
        event: input.event,
      }),
    );
    appendTimelineEventStep(timelineInput);

    // 2) Resolver contexto comercial (fulfillment/order + flags de idempotencia).
    const projectionInput = transform(
      { transitioned, input },
      ({ transitioned, input }) => ({
        execution_id: transitioned.execution_id,
        to_status: input.to_status as string,
      }),
    );
    const projection = resolveProjectionContextStep(projectionInput);

    // 3a) Proyectar shipped (createOrderShipmentWorkflow) solo si:
    //   - el nuevo estado implica "salió" (picked_up/in_transit/at_pickup_point),
    //   - el fulfillment AÚN NO está shipped (idempotencia, leído ANTES),
    //   - hay fulfillment_id + order_id resueltos por el link.
    when({ projection }, ({ projection }) =>
      SHIPPED_PROJECTION_STATUSES.has(projection.to_status) &&
      !projection.already_shipped &&
      Boolean(projection.fulfillment_id) &&
      Boolean(projection.order_id),
    ).then(() => {
      const shipmentInput = transform({ projection }, ({ projection }) => ({
        order_id: projection.order_id as string,
        fulfillment_id: projection.fulfillment_id as string,
        items: projection.items,
        labels: projection.tracking_number
          ? [
              {
                tracking_number: projection.tracking_number,
                tracking_url: buildAndreaniTrackingUrl(projection.tracking_number) ?? '',
                label_url: '',
              },
            ]
          : [],
      }));

      createOrderShipmentWorkflow.runAsStep({ input: shipmentInput });
    });

    // 3a-bis) Notificar "en camino" por WhatsApp SOLO para flota propia, cuando
    // sale a reparto por primera vez (misma señal de idempotencia que shipped:
    // !already_shipped, leído ANTES de proyectar). Andreani NO entra acá: su
    // WhatsApp de seguimiento lo dispara `andreani.ticket_generated`. Best-effort
    // en el step: un fallo al emitir no rompe la transición.
    when({ projection }, ({ projection }) =>
      SHIPPED_PROJECTION_STATUSES.has(projection.to_status) &&
      !projection.already_shipped &&
      projection.provider_type === 'own_fleet' &&
      Boolean(projection.order_id),
    ).then(() => {
      const ownFleetInput = transform({ projection }, ({ projection }) => ({
        order_id: projection.order_id as string,
        driver_id: projection.driver_id,
        vehicle_id: projection.vehicle_id,
      }));

      emitOwnFleetOutForDeliveryStep(ownFleetInput);
    });

    // 3b) Proyectar delivered (markFulfillmentAsDeliveredWorkflow) solo si el
    // nuevo estado es 'delivered' y el fulfillment AÚN NO está delivered.
    when({ projection }, ({ projection }) =>
      projection.to_status === 'delivered' &&
      !projection.already_delivered &&
      Boolean(projection.fulfillment_id),
    ).then(() => {
      const deliveredInput = transform({ projection }, ({ projection }) => ({
        id: projection.fulfillment_id as string,
      }));

      markFulfillmentAsDeliveredWorkflow.runAsStep({ input: deliveredInput });
    });

    return new WorkflowResponse(
      transform({ transitioned, projection }, ({ transitioned, projection }) => ({
        execution_id: transitioned.execution_id,
        status: transitioned.status,
        fulfillment_id: projection.fulfillment_id,
        order_id: projection.order_id,
        projected_shipped:
          SHIPPED_PROJECTION_STATUSES.has(projection.to_status) &&
          !projection.already_shipped,
        projected_delivered:
          projection.to_status === 'delivered' && !projection.already_delivered,
      })),
    );
  },
);

export default transitionDeliveryExecutionWorkflow;
