/**
 * create-route (M7) — crea una Route de FLOTA PROPIA y, opcionalmente, sus
 * RouteStops ordenados a partir de una lista de DeliveryExecutions.
 *
 * SOLO FLOTA PROPIA: las ejecuciones a rutear DEBEN ser provider_type='own_fleet'.
 * Andreani (lo rutea el carrier) y store_pickup (sin recorrido) se rechazan. Esto
 * se valida acá, no en el modelo, porque depende del estado en vivo de cada
 * ejecución.
 *
 * Flujo:
 *  1) Genera un `code` legible y crea la Route en estado 'planned'.
 *  2) Si vienen `execution_ids`: valida que cada ejecución exista, sea own_fleet,
 *     no esté en estado terminal y no esté ya en otra ruta. Lee lat/lng de la
 *     dirección de la orden (vía link delivery_execution_order → order.shipping_address)
 *     y crea un RouteStop por ejecución con sequence 1..n en el orden recibido.
 *  3) Setea execution.route_id en cada ejecución ruteada.
 *
 * Compensación: borra la Route y los RouteStops creados y limpia el route_id de
 * las ejecuciones afectadas.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { isTerminalDeliveryStatus } from '../modules/delivery/types';
import { extractLatLng } from '../modules/delivery/geo';

export interface CreateRouteInput {
  store_location_id?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
  /** Fecha planificada (ISO o Date). */
  planned_date?: string | Date | null;
  /** Ejecuciones a rutear, en el orden deseado (sequence 1..n). */
  execution_ids?: string[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Genera un code legible: RT-YYYYMMDD-XXXX (sufijo aleatorio corto). */
const generateRouteCode = (): string => {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RT-${ymd}-${suffix}`;
};

interface CreateRouteRecordResult {
  route_id: string;
  code: string;
}

/** Step 1: crea la Route en 'planned'. Compensación: la borra. */
const createRouteRecordStep = createStep(
  'create-route-record',
  async (input: CreateRouteInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    const code = generateRouteCode();
    const created = await service.createRoutes({
      code,
      driver_id: input.driver_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      store_location_id: input.store_location_id ?? null,
      status: 'planned',
      planned_date: input.planned_date
        ? new Date(input.planned_date as string)
        : null,
    });
    const record = (Array.isArray(created) ? created[0] : created) as
      | UnknownRecord
      | undefined;
    if (!record) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'No se pudo crear la Route.',
      );
    }

    const result: CreateRouteRecordResult = {
      route_id: String(record.id),
      code,
    };
    return new StepResponse(result, result.route_id);
  },
  async (routeId: string | undefined, { container }) => {
    if (!routeId) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    await service.deleteRoutes([routeId]);
  },
);

interface CreateStopsInput {
  route_id: string;
  execution_ids: string[];
}

interface CreatedStopsSnapshot {
  route_id: string;
  stop_ids: string[];
  execution_ids: string[];
}

/**
 * Step 2: valida las ejecuciones (own_fleet, no terminal, sin ruta), lee lat/lng
 * de la orden linkeada y crea los RouteStops con sequence 1..n. Setea route_id en
 * cada ejecución. Compensación: borra stops y limpia route_id.
 */
const createRouteStopsStep = createStep(
  'create-route-stops',
  async (input: CreateStopsInput, { container }) => {
    const empty: CreatedStopsSnapshot = {
      route_id: input.route_id,
      stop_ids: [],
      execution_ids: [],
    };
    if (!input.execution_ids.length) {
      return new StepResponse(empty, empty);
    }

    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // Resolvemos ejecuciones + dirección de la orden linkeada en una sola query.
    const { data: executions } = await query.graph({
      entity: 'delivery_execution',
      fields: [
        'id',
        'provider_type',
        'status',
        'route_id',
        // metadata.geocoded de la propia execution (fallback de coords cuando el
        // address no las trae; lo persiste create-delivery-execution al geocodificar).
        'metadata',
        'order.shipping_address.metadata',
      ],
      filters: { id: input.execution_ids },
    });

    const byId = new Map<string, UnknownRecord>();
    for (const e of (executions ?? []) as UnknownRecord[]) {
      byId.set(String(e.id), e);
    }

    const stopIds: string[] = [];
    const touchedExecutionIds: string[] = [];

    // Recorremos en el ORDEN recibido para asignar sequence 1..n.
    let sequence = 1;
    for (const executionId of input.execution_ids) {
      const execution = byId.get(executionId);
      if (!execution) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `DeliveryExecution ${executionId} no existe.`,
        );
      }

      const providerType = String(execution.provider_type);
      if (providerType !== 'own_fleet') {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Solo se rutea flota propia: la ejecución ${executionId} es '${providerType}'.`,
        );
      }

      const status = String(execution.status);
      if (isTerminalDeliveryStatus(status)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `La ejecución ${executionId} está en estado terminal '${status}'; no se puede rutear.`,
        );
      }

      const existingRouteId = execution.route_id as string | null;
      if (existingRouteId && existingRouteId !== input.route_id) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `La ejecución ${executionId} ya pertenece a la ruta ${existingRouteId}.`,
        );
      }

      // lat/lng snapshot. Fuente 1: address.metadata (normalizado con
      // extractLatLng — acepta {lat,lng} y {latitude,longitude}). Fuente 2
      // (fallback): metadata.geocoded de la propia execution, que
      // create-delivery-execution persiste cuando geocodifica la dirección.
      const order = isRecord(execution.order) ? execution.order : undefined;
      const addr = isRecord(order?.shipping_address)
        ? (order!.shipping_address as UnknownRecord)
        : undefined;
      const execMeta = isRecord(execution.metadata)
        ? (execution.metadata as UnknownRecord)
        : undefined;

      const coords =
        extractLatLng(addr?.metadata) ?? extractLatLng(execMeta?.geocoded);
      const lat = coords ? coords.lat : null;
      const lng = coords ? coords.lng : null;

      const createdStop = await service.createRouteStops({
        route_id: input.route_id,
        delivery_execution_id: executionId,
        sequence,
        status: 'pending',
        lat,
        lng,
      });
      const stop = (Array.isArray(createdStop) ? createdStop[0] : createdStop) as
        | UnknownRecord
        | undefined;
      if (!stop) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `No se pudo crear el RouteStop para la ejecución ${executionId}.`,
        );
      }
      stopIds.push(String(stop.id));

      await service.updateDeliveryExecutions({
        id: executionId,
        route_id: input.route_id,
      });
      touchedExecutionIds.push(executionId);

      sequence += 1;
    }

    const snapshot: CreatedStopsSnapshot = {
      route_id: input.route_id,
      stop_ids: stopIds,
      execution_ids: touchedExecutionIds,
    };
    return new StepResponse(snapshot, snapshot);
  },
  async (snapshot: CreatedStopsSnapshot | undefined, { container }) => {
    if (!snapshot) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    if (snapshot.stop_ids.length) {
      await service.deleteRouteStops(snapshot.stop_ids);
    }
    for (const executionId of snapshot.execution_ids) {
      await service.updateDeliveryExecutions({
        id: executionId,
        route_id: null,
      });
    }
  },
);

export const createRouteWorkflow = createWorkflow(
  'create-route',
  (input: CreateRouteInput) => {
    const route = createRouteRecordStep(input);

    const stopsInput = transform({ route, input }, ({ route, input }) => ({
      route_id: route.route_id,
      execution_ids: input.execution_ids ?? [],
    }));
    const stops = createRouteStopsStep(stopsInput);

    return new WorkflowResponse(
      transform({ route, stops }, ({ route, stops }) => ({
        route_id: route.route_id,
        code: route.code,
        status: 'planned' as const,
        stop_count: stops.stop_ids.length,
      })),
    );
  },
);

export default createRouteWorkflow;
