/**
 * attach-execution-to-route — al asignar un driver a una DeliveryExecution de
 * FLOTA PROPIA, mete esa ejecución en la ruta ABIERTA de ESE driver para el DÍA:
 *
 *  - Si el driver NO tiene ruta abierta hoy → crea una ruta nueva (create-route)
 *    con esta ejecución como primera (y única) parada.
 *  - Si el driver YA tiene una ruta abierta hoy → agrega la ejecución como una
 *    parada más al final (update-route-stops con la lista completa deseada).
 *  - Reasignación: si la ejecución YA estaba en una ruta de OTRO driver, primero
 *    la SACA de la ruta vieja (update-route-stops sin esta ejecución, que limpia
 *    su route_id y resecuencia) y luego la mete en la del driver nuevo.
 *
 * SOLO FLOTA PROPIA: Andreani (lo rutea el carrier) y store_pickup (sin recorrido)
 * NO se rutean. Si la ejecución no es own_fleet, este workflow es un NO-OP.
 *
 * "Ruta abierta del día": una Route del driver con status NO terminal (no
 * completed/canceled) cuyo planned_date cae en el MISMO día calendario que la
 * fecha objetivo (hoy por defecto). El filtro de día se hace en JS sobre
 * planned_date porque los list* auto-generados de Medusa no aplican de forma
 * confiable operadores de comparación ($gte/$lt) sobre campos dateTime (mismo
 * criterio que minimum-purchase y auto-build-routes en este repo).
 *
 * DISEÑO — best-effort, NO transaccional respecto al assign:
 * Este workflow se invoca con .run() DESDE un step de assign-delivery, envuelto en
 * try/catch. La asignación (driver_id/vehicle_id + transición a 'assigned') es lo
 * CRÍTICO; la ruta es un artefacto DERIVADO. Si el ruteo falla, NO debe tumbar la
 * asignación ya realizada. Internamente este workflow SÍ tiene compensaciones
 * (las heredadas de create-route / update-route-stops), pero su fallo se aísla en
 * el caller. Ver assign-delivery.ts (attachToRouteStep).
 *
 * Idempotencia: si la ejecución YA está en la ruta abierta del driver, no hace
 * nada (ni recrea stop ni reordena).
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import {
  DELIVERY_TERMINAL_STATUSES,
  ROUTE_TERMINAL_STATUSES,
} from '../modules/delivery/types';
import createRouteWorkflow from './create-route';
import updateRouteStopsWorkflow from './update-route-stops';

export interface AttachExecutionToRouteInput {
  execution_id: string;
  driver_id: string;
  vehicle_id?: string | null;
  store_location_id?: string | null;
  /** Fecha objetivo (ISO o Date). Default: hoy. */
  date?: string | Date | null;
}

export interface AttachExecutionToRouteOutput {
  attached: boolean;
  /** Motivo cuando attached=false (no_op para no-own_fleet/terminal, etc.). */
  reason?: string;
  route_id?: string | null;
  /** 'created' = ruta nueva; 'appended' = agregada a ruta existente; 'noop'. */
  action: 'created' | 'appended' | 'noop';
}

type UnknownRecord = Record<string, unknown>;

/** Inicio del día calendario (medianoche local) de una fecha dada. */
const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** True si dos fechas caen en el MISMO día calendario (local). */
const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Step único: orquesta el upsert de ruta invocando create-route /
 * update-route-stops por su API .run() con el mismo container (el SDK no permite
 * loops/condicionales dinámicos sobre runAsStep en la definición del workflow;
 * mismo patrón que dispatch-route).
 *
 * NO declara compensación propia: los workflows internos que invoca traen las
 * suyas y, ante un fallo a mitad, cada uno revierte su propio efecto. El caller
 * (assign-delivery) además aísla cualquier fallo de este workflow en try/catch.
 */
const upsertDriverRouteStep = createStep(
  'attach-execution-upsert-driver-route',
  async (
    input: AttachExecutionToRouteInput,
    { container },
  ): Promise<StepResponse<AttachExecutionToRouteOutput>> => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    const noop = (reason: string): StepResponse<AttachExecutionToRouteOutput> =>
      new StepResponse<AttachExecutionToRouteOutput>({
        attached: false,
        reason,
        route_id: null,
        action: 'noop',
      });

    // 1) Resolver la ejecución. Solo own_fleet, no terminal, se rutea.
    const execution = (await service
      .retrieveDeliveryExecution(input.execution_id)
      .catch(() => null)) as UnknownRecord | null;
    if (!execution) {
      return noop('execution_not_found');
    }

    const providerType = String(execution.provider_type);
    if (providerType !== 'own_fleet') {
      // Andreani / store_pickup no se rutean.
      return noop('not_own_fleet');
    }

    const status = String(execution.status);
    if ((DELIVERY_TERMINAL_STATUSES as string[]).includes(status)) {
      return noop('execution_terminal');
    }

    // 2) Fecha objetivo (medianoche del día) y store_location_id (de la
    //    ejecución si no vino explícito).
    const targetDate = startOfDay(
      input.date ? new Date(input.date as string) : new Date(),
    );
    const storeLocationId =
      input.store_location_id ??
      ((execution.store_location_id as string | null | undefined) ?? null);

    const currentRouteId = (execution.route_id as string | null) ?? null;

    // 3) Buscar la ruta ABIERTA del driver para el día. Filtramos por driver +
    //    status no terminal en DB, y el día en JS sobre planned_date.
    const driverRoutes = (await service.listRoutes(
      {
        driver_id: input.driver_id,
        status: { $nin: [...ROUTE_TERMINAL_STATUSES] },
      },
      { order: { created_at: 'DESC' } },
    )) as UnknownRecord[];

    const openRouteToday = driverRoutes.find((r) => {
      const planned = r.planned_date ? new Date(r.planned_date as string) : null;
      return planned !== null && isSameDay(planned, targetDate);
    });
    const targetRouteId = openRouteToday
      ? String(openRouteToday.id)
      : null;

    // 4) Idempotencia: si la ejecución YA está en la ruta destino, no hacer nada.
    if (targetRouteId && currentRouteId === targetRouteId) {
      return new StepResponse<AttachExecutionToRouteOutput>({
        attached: true,
        route_id: targetRouteId,
        action: 'noop',
      });
    }

    // 5) Reasignación: si la ejecución está en OTRA ruta (distinta de la destino),
    //    sacarla de la ruta vieja. update-route-stops con la lista SIN esta
    //    ejecución limpia su route_id y resecuencia. Si la ruta vieja queda
    //    vacía, se deja vacía (no la borramos, para no complicar; ver TODO).
    if (currentRouteId && currentRouteId !== targetRouteId) {
      const oldStops = (await service.listRouteStops(
        { route_id: currentRouteId },
        { order: { sequence: 'ASC' } },
      )) as UnknownRecord[];

      const remaining = oldStops
        .filter(
          (s) => String(s.delivery_execution_id) !== input.execution_id,
        )
        .map((s, idx) => ({
          delivery_execution_id: String(s.delivery_execution_id),
          sequence: idx + 1,
        }));

      await updateRouteStopsWorkflow(container).run({
        input: { route_id: currentRouteId, stops: remaining },
      });
    }

    // 6a) NO hay ruta abierta hoy → crear una nueva con esta ejecución de primera.
    if (!targetRouteId) {
      const { result } = await createRouteWorkflow(container).run({
        input: {
          store_location_id: storeLocationId,
          driver_id: input.driver_id,
          vehicle_id: input.vehicle_id ?? null,
          planned_date: targetDate,
          execution_ids: [input.execution_id],
        },
      });
      return new StepResponse<AttachExecutionToRouteOutput>({
        attached: true,
        route_id: result.route_id,
        action: 'created',
      });
    }

    // 6b) HAY ruta abierta → agregar esta ejecución al final de las paradas
    //     actuales (lista completa deseada = existentes + nueva).
    const currentStops = (await service.listRouteStops(
      { route_id: targetRouteId },
      { order: { sequence: 'ASC' } },
    )) as UnknownRecord[];

    const desiredStops = currentStops.map((s, idx) => ({
      delivery_execution_id: String(s.delivery_execution_id),
      sequence: idx + 1,
    }));
    desiredStops.push({
      delivery_execution_id: input.execution_id,
      sequence: desiredStops.length + 1,
    });

    await updateRouteStopsWorkflow(container).run({
      input: { route_id: targetRouteId, stops: desiredStops },
    });

    return new StepResponse<AttachExecutionToRouteOutput>({
      attached: true,
      route_id: targetRouteId,
      action: 'appended',
    });
  },
);

export const attachExecutionToRouteWorkflow = createWorkflow(
  'attach-execution-to-route',
  (input: AttachExecutionToRouteInput) => {
    const result = upsertDriverRouteStep(input);
    return new WorkflowResponse(result);
  },
);

export default attachExecutionToRouteWorkflow;
