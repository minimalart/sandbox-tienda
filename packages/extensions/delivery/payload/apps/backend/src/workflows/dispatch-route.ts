/**
 * dispatch-route (M7) — despacha una Route: marca la ruta 'dispatched' +
 * started_at y propaga la asignación del driver/vehicle de la ruta a CADA
 * ejecución que todavía no esté asignada, reusando el workflow assign-delivery.
 *
 * NO duplica la lógica de asignación: por cada parada cuya ejecución aún no tiene
 * driver, invoca assign-delivery (que valida, persiste driver_id/vehicle_id,
 * transiciona a 'assigned' y marca el driver on_route). assign-delivery ya es
 * idempotente respecto a su propio efecto y no proyecta a Medusa ('assigned' no
 * es hito comercial).
 *
 * Precondiciones:
 *  - La ruta debe tener `driver_id`. Sin driver no se puede despachar.
 *  - La ruta no debe estar en estado terminal.
 *
 * Diseño: la resolución de qué ejecuciones asignar se hace en un step (loadStops)
 * que devuelve la lista; luego se itera con assign-delivery.runAsStep. Como el
 * SDK de workflows no permite loops dinámicos sobre runAsStep en la definición,
 * la iteración de asignación se hace dentro de un step dedicado que invoca el
 * workflow assign-delivery por su API .run() con el mismo container.
 *
 * Compensación: el step de marcado de ruta restaura status/started_at previos.
 * Las asignaciones individuales NO se compensan acá (cada assign-delivery maneja
 * su propia compensación interna si falla a mitad); un fallo posterior deja las
 * ejecuciones asignadas, que es el estado deseado de un despacho.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import {
  isTerminalRouteStatus,
  isTerminalDeliveryStatus,
} from '../modules/delivery/types';
import assignDeliveryWorkflow from './assign-delivery';

export interface DispatchRouteInput {
  route_id: string;
}

type UnknownRecord = Record<string, unknown>;

interface MarkSnapshot {
  route_id: string;
  prev_status: string;
  prev_started_at: Date | null;
}

interface MarkResult {
  route_id: string;
  driver_id: string;
  vehicle_id: string | null;
}

/**
 * Step 1: valida la ruta (tiene driver, no terminal) y la marca 'dispatched' +
 * started_at. Compensación: restaura status/started_at previos.
 */
const markRouteDispatchedStep = createStep(
  'mark-route-dispatched',
  async (input: DispatchRouteInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    const route = (await service
      .retrieveRoute(input.route_id)
      .catch(() => null)) as UnknownRecord | null;
    if (!route) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Route ${input.route_id} no existe.`,
      );
    }

    const status = String(route.status);
    if (isTerminalRouteStatus(status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `La ruta ${input.route_id} está en estado terminal '${status}'; no se puede despachar.`,
      );
    }

    const driverId = route.driver_id as string | null;
    if (!driverId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `La ruta ${input.route_id} no tiene driver asignado; asigná uno antes de despachar.`,
      );
    }

    const prevStartedAt = route.started_at
      ? new Date(route.started_at as string)
      : null;
    const snapshot: MarkSnapshot = {
      route_id: input.route_id,
      prev_status: status,
      prev_started_at: prevStartedAt,
    };

    await service.updateRoutes({
      id: input.route_id,
      status: 'dispatched',
      started_at: prevStartedAt ?? new Date(),
    });

    const result: MarkResult = {
      route_id: input.route_id,
      driver_id: driverId,
      vehicle_id: (route.vehicle_id as string | null) ?? null,
    };
    return new StepResponse(result, snapshot);
  },
  async (snapshot: MarkSnapshot | undefined, { container }) => {
    if (!snapshot) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    await service.updateRoutes({
      id: snapshot.route_id,
      status: snapshot.prev_status,
      started_at: snapshot.prev_started_at,
    });
  },
);

interface AssignStopsResult {
  assigned: number;
  skipped: number;
}

/**
 * Step 2: por cada ejecución de la ruta SIN driver asignado y no terminal,
 * invoca el workflow assign-delivery con el driver/vehicle de la ruta. REUSA la
 * lógica de asignación; no la duplica.
 */
const assignRouteExecutionsStep = createStep(
  'assign-route-executions',
  async (input: MarkResult, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    const stops = (await service.listRouteStops(
      { route_id: input.route_id },
      { order: { sequence: 'ASC' } },
    )) as UnknownRecord[];

    let assigned = 0;
    let skipped = 0;

    for (const stop of stops) {
      const executionId = String(stop.delivery_execution_id);
      const execution = (await service
        .retrieveDeliveryExecution(executionId)
        .catch(() => null)) as UnknownRecord | null;
      if (!execution) {
        skipped += 1;
        continue;
      }

      // Saltamos las ya asignadas (a cualquier driver) y las terminales.
      if (execution.driver_id || isTerminalDeliveryStatus(String(execution.status))) {
        skipped += 1;
        continue;
      }

      await assignDeliveryWorkflow(container).run({
        input: {
          execution_id: executionId,
          driver_id: input.driver_id,
          vehicle_id: input.vehicle_id ?? undefined,
          set_driver_on_route: true,
        },
      });
      assigned += 1;
    }

    const result: AssignStopsResult = { assigned, skipped };
    return new StepResponse(result);
  },
);

export const dispatchRouteWorkflow = createWorkflow(
  'dispatch-route',
  (input: DispatchRouteInput) => {
    const marked = markRouteDispatchedStep(input);
    const assignment = assignRouteExecutionsStep(marked);

    return new WorkflowResponse(
      transform({ marked, assignment }, ({ marked, assignment }) => ({
        route_id: marked.route_id,
        status: 'dispatched' as const,
        driver_id: marked.driver_id,
        vehicle_id: marked.vehicle_id,
        assigned: assignment.assigned,
        skipped: assignment.skipped,
      })),
    );
  },
);

export default dispatchRouteWorkflow;
