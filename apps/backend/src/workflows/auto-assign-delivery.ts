/**
 * auto-assign-delivery (F5) — asignación AUTOMÁTICA de flota propia a una
 * DeliveryExecution. Resuelve los recursos elegibles, elige driver (+ vehicle)
 * según una estrategia y delega la asignación/transición en assign-delivery
 * (NO la duplica).
 *
 * PRECEDENCIA DE ESTRATEGIA (resuelta en resolveAutoAssignContextStep):
 *   1) input.strategy            — override manual del caller (endpoint/UI).
 *   2) decision.assign_strategy  — fijada por la regla de despacho ganadora.
 *   3) zone.metadata.default_assign_strategy — default por zona.
 *   4) DEFAULT_ASSIGN_STRATEGY   — fallback global ('least_load').
 *  (2-4 las resuelve service.resolveAssignStrategy; el override de 1 va antes.)
 *
 * ESTADO DE ROUND-ROBIN: se persiste en DeliveryZone.metadata.last_assigned_driver_id
 * (estado por zona, scope natural del pool de drivers de esa zona). pickResources
 * lee ese valor ANTES de elegir y, tras elegir, lo actualiza al driver elegido.
 * La compensación restaura el valor previo. Si la ejecución no tiene zona
 * resuelta, no hay dónde persistir el estado → round_robin degrada a
 * first_available de forma determinística (siempre el primero por id asc).
 *
 * NO lanza error si no hay recursos elegibles: devuelve { assigned: false } con
 * un `reason` y la lista de `rejected` para que la UI muestre los motivos.
 *
 * VEHÍCULO OPCIONAL: si no hay vehículo elegible, se asigna SOLO el driver. La
 * elegibilidad (getEligibleResources) ya excluyó vehículos que no cumplen frío/
 * capacidad; si la lista quedó vacía, o bien no hay vehículos configurados o
 * ninguno sirve. Preferimos asignar el driver igual (puede usar vehículo propio
 * / moto no registrada) antes que bloquear el despacho. El requerimiento de frío
 * estricto, si existe, ya habría dejado fuera a los vehículos no aptos — que NO
 * haya vehículo apto con frío es una condición que la UI ve vía `rejected`.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { fetchExecutionOrderAggregate } from '../modules/delivery/order-query';
import type { AssignStrategy } from '../modules/delivery/types';
import {
  pickDriver,
  pickVehicle,
  isValidAssignStrategy,
  type EligibleDriver,
  type EligibleVehicle,
} from '../modules/delivery/assignment-strategies';
import assignDeliveryWorkflow from './assign-delivery';

export interface AutoAssignDeliveryInput {
  execution_id: string;
  /** Override manual de la estrategia (máxima precedencia). Opcional. */
  strategy?: AssignStrategy | string;
  /** Override manual de vehículo (salta el best-fit). Opcional. */
  vehicle_id?: string;
}

export interface AutoAssignDeliveryOutput {
  execution_id: string;
  assigned: boolean;
  driver_id?: string | null;
  vehicle_id?: string | null;
  strategy: AssignStrategy;
  reason?: string;
  rejected: { resource_type: string; id: string; reason: string }[];
}

type UnknownRecord = Record<string, unknown>;

interface AutoAssignContext {
  execution_id: string;
  eligible_drivers: EligibleDriver[];
  eligible_vehicles: EligibleVehicle[];
  strategy: AssignStrategy;
  zone_id: string | null;
  rejected: { resource_type: string; id: string; reason: string }[];
  /** Estado de round-robin leído de la zona (para pickDriver). */
  last_assigned_driver_id: string | null;
}

interface PickedResources {
  execution_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  strategy: AssignStrategy;
  reason: string | null;
  rejected: { resource_type: string; id: string; reason: string }[];
}

/** Compensación del bump de round-robin: restaura el valor previo en la zona. */
interface RrCompensation {
  zone_id: string;
  prev_last_assigned_driver_id: string | null;
}

/**
 * Step 1: arma el contexto de auto-asignación. Resuelve elegibles
 * (getEligibleResources), la zona de la ejecución y la estrategia efectiva por
 * precedencia (override manual > regla > zona > default). Solo lectura.
 */
const resolveAutoAssignContextStep = createStep(
  'resolve-auto-assign-context',
  async (input: AutoAssignDeliveryInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // El agregado de la orden (peso/conteo/temperatura/volumen) se computa acá
    // con query.graph porque el module container NO tiene QUERY registrado.
    const orderAggregate = await fetchExecutionOrderAggregate(
      query,
      input.execution_id,
    );
    const eligibility = await service.getEligibleResources(
      input.execution_id,
      orderAggregate,
    );

    const execution = (await service
      .retrieveDeliveryExecution(input.execution_id)
      .catch(() => null)) as
      | (UnknownRecord & { delivery_zone_id?: string | null })
      | null;
    const zoneId =
      (execution?.delivery_zone_id as string | null | undefined) ?? null;

    // Zona (para metadata: default_assign_strategy + estado de round-robin).
    const zone = zoneId
      ? ((await service
          .retrieveDeliveryZone(zoneId)
          .catch(() => null)) as (UnknownRecord & { metadata?: unknown }) | null)
      : null;

    // Decisión (para la assign_strategy de la regla ganadora). Best-effort:
    // si no hay zona/reglas, resolveDeliveryDecision devuelve una decisión neutra.
    const decision = await service
      .resolveDeliveryDecision({}, { zone_id: zoneId ?? undefined })
      .catch(() => null);

    // Precedencia: override manual válido > (regla > zona > default).
    const manual =
      typeof input.strategy === 'string' && isValidAssignStrategy(input.strategy)
        ? input.strategy
        : null;
    const strategy: AssignStrategy =
      manual ?? service.resolveAssignStrategy(decision, zone);

    const meta =
      zone && typeof zone.metadata === 'object' && zone.metadata
        ? (zone.metadata as Record<string, unknown>)
        : null;
    const lastAssigned =
      typeof meta?.last_assigned_driver_id === 'string'
        ? (meta.last_assigned_driver_id as string)
        : null;

    const ctx: AutoAssignContext = {
      execution_id: input.execution_id,
      eligible_drivers: eligibility.eligible_drivers,
      eligible_vehicles: input.vehicle_id
        ? [{ id: input.vehicle_id }]
        : (eligibility.eligible_vehicles as EligibleVehicle[]),
      strategy,
      zone_id: zoneId,
      rejected: eligibility.rejected,
      last_assigned_driver_id: lastAssigned,
    };
    return new StepResponse(ctx);
  },
);

/**
 * Step 2: aplica las estrategias PURAS (pickDriver/pickVehicle). Para
 * round_robin, tras elegir actualiza zone.metadata.last_assigned_driver_id
 * (compensación restaura el valor previo). Si no hay driver elegible, devuelve
 * { driver_id: null, reason: 'no_eligible_driver' } SIN error.
 */
const pickResourcesStep = createStep(
  'pick-resources',
  async (ctx: AutoAssignContext, { container }) => {
    const driverId = pickDriver(ctx.eligible_drivers, ctx.strategy, {
      last_assigned_driver_id: ctx.last_assigned_driver_id,
    });

    if (!driverId) {
      const result: PickedResources = {
        execution_id: ctx.execution_id,
        driver_id: null,
        vehicle_id: null,
        strategy: ctx.strategy,
        reason: 'no_eligible_driver',
        rejected: ctx.rejected,
      };
      return new StepResponse(result, null);
    }

    // Vehículo: best-fit puro (o el override ya inyectado como único elegible).
    const vehicleId = pickVehicle(ctx.eligible_vehicles, ctx.strategy);

    // Estado de round-robin: persistir el driver elegido como "último asignado".
    // Solo aplica si la estrategia es round_robin Y hay zona donde guardarlo.
    let compensation: RrCompensation | null = null;
    if (ctx.strategy === 'round_robin' && ctx.zone_id) {
      const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
      const zone = (await service
        .retrieveDeliveryZone(ctx.zone_id)
        .catch(() => null)) as (UnknownRecord & { metadata?: unknown }) | null;
      const meta =
        zone && typeof zone.metadata === 'object' && zone.metadata
          ? { ...(zone.metadata as Record<string, unknown>) }
          : {};
      const prev =
        typeof meta.last_assigned_driver_id === 'string'
          ? (meta.last_assigned_driver_id as string)
          : null;

      meta.last_assigned_driver_id = driverId;
      await service.updateDeliveryZones({ id: ctx.zone_id, metadata: meta });

      compensation = {
        zone_id: ctx.zone_id,
        prev_last_assigned_driver_id: prev,
      };
    }

    const result: PickedResources = {
      execution_id: ctx.execution_id,
      driver_id: driverId,
      vehicle_id: vehicleId,
      strategy: ctx.strategy,
      reason: null,
      rejected: ctx.rejected,
    };
    return new StepResponse(result, compensation);
  },
  async (comp: RrCompensation | null | undefined, { container }) => {
    if (!comp) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const zone = (await service
      .retrieveDeliveryZone(comp.zone_id)
      .catch(() => null)) as (UnknownRecord & { metadata?: unknown }) | null;
    if (!zone) return;
    const meta =
      zone && typeof zone.metadata === 'object' && zone.metadata
        ? { ...(zone.metadata as Record<string, unknown>) }
        : {};
    if (comp.prev_last_assigned_driver_id === null) {
      delete meta.last_assigned_driver_id;
    } else {
      meta.last_assigned_driver_id = comp.prev_last_assigned_driver_id;
    }
    await service.updateDeliveryZones({ id: comp.zone_id, metadata: meta });
  },
);

export const autoAssignDeliveryWorkflow = createWorkflow(
  'auto-assign-delivery',
  (input: AutoAssignDeliveryInput) => {
    const ctx = resolveAutoAssignContextStep(input);
    const picked = pickResourcesStep(ctx);

    // Si hay driver elegido, delegamos en assign-delivery (valida, persiste,
    // transiciona a 'assigned' y marca on_route). Reuso, no duplicación.
    when({ picked }, ({ picked }) => picked.driver_id !== null).then(() => {
      const assignInput = transform({ picked }, ({ picked }) => ({
        execution_id: picked.execution_id,
        driver_id: picked.driver_id as string,
        vehicle_id: picked.vehicle_id ?? undefined,
        set_driver_on_route: true,
        // Auto-asignar también mete la ejecución en la ruta del driver/día.
        attach_to_route: true,
      }));
      assignDeliveryWorkflow.runAsStep({ input: assignInput });
    });

    return new WorkflowResponse(
      transform({ picked }, ({ picked }): AutoAssignDeliveryOutput => ({
        execution_id: picked.execution_id,
        assigned: picked.driver_id !== null,
        driver_id: picked.driver_id,
        vehicle_id: picked.vehicle_id,
        strategy: picked.strategy,
        reason: picked.reason ?? undefined,
        rejected: picked.rejected,
      })),
    );
  },
);

export default autoAssignDeliveryWorkflow;
