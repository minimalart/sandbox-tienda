import type { RemoteQueryFunction } from '@medusajs/framework/types';
/**
 * update-route-stops (M7) — reordena / agrega / quita las paradas de una Route a
 * partir de la lista DESEADA completa.
 *
 * La lista `stops` es la VERDAD: representa el estado final que debe tener la
 * ruta. El workflow hace un diff contra los RouteStops actuales:
 *   - ejecuciones en la lista que ya eran stop → se actualiza su `sequence`.
 *   - ejecuciones nuevas → se crean como RouteStop (con lat/lng de la orden).
 *   - stops actuales que NO están en la lista → se borran (y se limpia route_id).
 *
 * Consistencia de route_id: las ejecuciones que entran quedan con route_id de la
 * ruta; las que salen quedan con route_id null. Se valida que las ejecuciones
 * nuevas sean own_fleet, no terminales y no estén en OTRA ruta.
 *
 * Reordenamiento del planner: el admin manda la lista completa con los
 * `sequence` recalculados (botones up/down reordenan el array y reenvían 1..n).
 *
 * Compensación: restaura el set de stops previo (sequences y pertenencia) y los
 * route_id de las ejecuciones afectadas.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { isTerminalDeliveryStatus } from '../modules/delivery/types';

export interface UpdateRouteStopInput {
  delivery_execution_id: string;
  sequence: number;
}

export interface UpdateRouteStopsInput {
  route_id: string;
  /** Estado final deseado de las paradas (orden = sequence). */
  stops: UpdateRouteStopInput[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Snapshot de un stop previo, para compensación (recrear / restaurar). */
interface PrevStopSnapshot {
  id: string;
  delivery_execution_id: string;
  sequence: number;
  status: string;
  lat: number | null;
  lng: number | null;
}

interface SyncSnapshot {
  route_id: string;
  /** Stops tal como estaban ANTES (para recrear los borrados / restaurar seq). */
  prev_stops: PrevStopSnapshot[];
  /** Ejecuciones que pasaron a pertenecer a la ruta (para limpiar en rollback). */
  added_execution_ids: string[];
  /** Ejecuciones que dejaron la ruta (para re-asociar en rollback). */
  removed_execution_ids: string[];
}

const syncRouteStopsStep = createStep(
  'sync-route-stops',
  async (input: UpdateRouteStopsInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(ContainerRegistrationKeys.QUERY);

    // Ruta debe existir y no estar terminal.
    const route = (await service
      .retrieveRoute(input.route_id)
      .catch(() => null)) as UnknownRecord | null;
    if (!route) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Route ${input.route_id} no existe.`,
      );
    }

    // Stops actuales de la ruta.
    const currentStops = (await service.listRouteStops({
      route_id: input.route_id,
    })) as UnknownRecord[];

    const prevStops: PrevStopSnapshot[] = currentStops.map((s) => ({
      id: String(s.id),
      delivery_execution_id: String(s.delivery_execution_id),
      sequence: Number(s.sequence) || 0,
      status: String(s.status),
      lat: toNumber(s.lat),
      lng: toNumber(s.lng),
    }));

    const currentByExecution = new Map<string, PrevStopSnapshot>();
    for (const s of prevStops) {
      currentByExecution.set(s.delivery_execution_id, s);
    }

    const desiredExecutionIds = input.stops.map((s) => s.delivery_execution_id);
    const desiredSet = new Set(desiredExecutionIds);

    // Ejecuciones NUEVAS (en la lista deseada pero no en los stops actuales).
    const newExecutionIds = desiredExecutionIds.filter(
      (id) => !currentByExecution.has(id),
    );

    // Validamos las nuevas: existen, own_fleet, no terminal, sin OTRA ruta.
    if (newExecutionIds.length) {
      const { data: executions } = await query.graph({
        entity: 'delivery_execution',
        fields: [
          'id',
          'provider_type',
          'status',
          'route_id',
          'order.shipping_address.metadata',
        ],
        filters: { id: newExecutionIds },
      });
      const byId = new Map<string, UnknownRecord>();
      for (const e of (executions ?? []) as UnknownRecord[]) {
        byId.set(String(e.id), e);
      }

      for (const executionId of newExecutionIds) {
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
        if (isTerminalDeliveryStatus(String(execution.status))) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            `La ejecución ${executionId} está en estado terminal; no se puede rutear.`,
          );
        }
        const existingRouteId = execution.route_id as string | null;
        if (existingRouteId && existingRouteId !== input.route_id) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            `La ejecución ${executionId} ya pertenece a la ruta ${existingRouteId}.`,
          );
        }
      }

      // Crear los stops nuevos con su sequence y lat/lng de la orden.
      for (const executionId of newExecutionIds) {
        const execution = byId.get(executionId)!;
        const desired = input.stops.find(
          (s) => s.delivery_execution_id === executionId,
        )!;
        const order = isRecord(execution.order) ? execution.order : undefined;
        const addr = isRecord(order?.shipping_address)
          ? (order!.shipping_address as UnknownRecord)
          : undefined;
        const meta = isRecord(addr?.metadata)
          ? (addr!.metadata as UnknownRecord)
          : undefined;

        await service.createRouteStops({
          route_id: input.route_id,
          delivery_execution_id: executionId,
          sequence: desired.sequence,
          status: 'pending',
          lat: toNumber(meta?.lat),
          lng: toNumber(meta?.lng),
        });
        await service.updateDeliveryExecutions({
          id: executionId,
          route_id: input.route_id,
        });
      }
    }

    // Actualizar sequence de los stops que SIGUEN en la ruta.
    for (const desired of input.stops) {
      const current = currentByExecution.get(desired.delivery_execution_id);
      if (current && current.sequence !== desired.sequence) {
        await service.updateRouteStops({
          id: current.id,
          sequence: desired.sequence,
        });
      }
    }

    // Borrar stops que YA NO están en la lista deseada + limpiar route_id.
    const removedStops = prevStops.filter(
      (s) => !desiredSet.has(s.delivery_execution_id),
    );
    if (removedStops.length) {
      await service.deleteRouteStops(removedStops.map((s) => s.id));
      for (const s of removedStops) {
        await service.updateDeliveryExecutions({
          id: s.delivery_execution_id,
          route_id: null,
        });
      }
    }

    const snapshot: SyncSnapshot = {
      route_id: input.route_id,
      prev_stops: prevStops,
      added_execution_ids: newExecutionIds,
      removed_execution_ids: removedStops.map((s) => s.delivery_execution_id),
    };
    return new StepResponse(
      { route_id: input.route_id, stop_count: input.stops.length },
      snapshot,
    );
  },
  async (snapshot: SyncSnapshot | undefined, { container }) => {
    if (!snapshot) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    // Estrategia de rollback: borrar TODOS los stops actuales de la ruta y
    // recrear exactamente el set previo (ids no se preservan, pero la ruta queda
    // con la misma composición y orden). Luego restaurar los route_id.
    const currentStops = (await service.listRouteStops({
      route_id: snapshot.route_id,
    })) as UnknownRecord[];
    if (currentStops.length) {
      await service.deleteRouteStops(currentStops.map((s) => String(s.id)));
    }

    for (const prev of snapshot.prev_stops) {
      await service.createRouteStops({
        route_id: snapshot.route_id,
        delivery_execution_id: prev.delivery_execution_id,
        sequence: prev.sequence,
        status: prev.status,
        lat: prev.lat,
        lng: prev.lng,
      });
    }

    // Ejecuciones agregadas → quitarles el route_id (volver a sin ruta).
    for (const executionId of snapshot.added_execution_ids) {
      await service.updateDeliveryExecutions({
        id: executionId,
        route_id: null,
      });
    }
    // Ejecuciones removidas → reasociarlas a la ruta.
    for (const executionId of snapshot.removed_execution_ids) {
      await service.updateDeliveryExecutions({
        id: executionId,
        route_id: snapshot.route_id,
      });
    }
  },
);

export const updateRouteStopsWorkflow = createWorkflow(
  'update-route-stops',
  (input: UpdateRouteStopsInput) => {
    const result = syncRouteStopsStep(input);
    return new WorkflowResponse(result);
  },
);

export default updateRouteStopsWorkflow;
