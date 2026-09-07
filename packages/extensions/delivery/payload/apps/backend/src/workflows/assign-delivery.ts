/**
 * assign-delivery — asigna un driver (+ vehicle opcional) a una DeliveryExecution
 * de flota propia y la transiciona a 'assigned'.
 *
 * Flujo:
 *  1) Resuelve la ejecución y valida que NO esté en estado terminal.
 *  2) Valida driver activo (y vehicle si viene) y persiste driver_id/vehicle_id
 *     en la ejecución, vía el provider own_fleet (assign()). El provider NO
 *     proyecta a Medusa: 'assigned' no es hito comercial.
 *  3) Transiciona a 'assigned' con transition-delivery-execution, emitiendo un
 *     evento source='system' code='assigned' que se appendea al timeline. Como
 *     'assigned' no cruza ningún hito comercial (no está en SHIPPED/delivered),
 *     ese workflow NO proyecta a Medusa.
 *  4) (Opcional) marca el driver como 'on_route'.
 *
 * Compensación: el step de asignación rollbackea driver_id/vehicle_id al valor
 * previo. La transición de estado NO se compensa (la state machine no admite
 * "des-transicionar"); si el assign falla, no se llega a transicionar.
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
import { isTerminalDeliveryStatus } from '../modules/delivery/types';
import { getDeliveryProvider } from '../modules/delivery/providers/registry';
import { transitionDeliveryExecutionWorkflow } from './transition-delivery-execution';
import attachExecutionToRouteWorkflow from './attach-execution-to-route';

export interface AssignDeliveryInput {
  execution_id: string;
  driver_id: string;
  vehicle_id?: string;
  /** Si true, marca el driver como 'on_route' tras asignar. Default true. */
  set_driver_on_route?: boolean;
  /**
   * Si true, tras asignar mete la ejecución en la ruta abierta del driver para
   * el día (o crea una nueva), y la mueve de la ruta vieja si se reasigna.
   * Default false → no cambia el comportamiento de quien no lo pida (p.ej.
   * dispatch-route, que NO debe re-rutear ejecuciones ya en la ruta despachada).
   */
  attach_to_route?: boolean;
}

type UnknownRecord = Record<string, unknown>;

interface AssignedSnapshot {
  execution_id: string;
  provider_type: string;
  /** Valores previos para compensación. */
  prev_driver_id: string | null;
  prev_vehicle_id: string | null;
}

/**
 * Step 1+2: valida no-terminal + asigna vía el provider own_fleet. Persiste
 * driver_id/vehicle_id. Compensación: restaura los valores previos.
 */
const assignViaProviderStep = createStep(
  'assign-delivery-via-provider',
  async (input: AssignDeliveryInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    const execution = (await service.retrieveDeliveryExecution(
      input.execution_id,
    )) as UnknownRecord;

    const status = String(execution.status);
    if (isTerminalDeliveryStatus(status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `DeliveryExecution ${input.execution_id} está en estado terminal '${status}'; no admite asignación.`,
      );
    }

    const providerType = String(execution.provider_type);
    const provider = getDeliveryProvider(providerType, container);
    if (typeof provider.assign !== 'function') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `El provider '${providerType}' no soporta asignación de flota propia.`,
      );
    }

    const snapshot: AssignedSnapshot = {
      execution_id: input.execution_id,
      provider_type: providerType,
      prev_driver_id: (execution.driver_id as string | null) ?? null,
      prev_vehicle_id: (execution.vehicle_id as string | null) ?? null,
    };

    // El provider valida driver/vehicle activos y persiste la asignación.
    await provider.assign(execution as never, {
      driverId: input.driver_id,
      vehicleId: input.vehicle_id,
    });

    return new StepResponse(snapshot, snapshot);
  },
  async (snapshot: AssignedSnapshot | undefined, { container }) => {
    if (!snapshot) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    await service.updateDeliveryExecutions({
      id: snapshot.execution_id,
      driver_id: snapshot.prev_driver_id,
      vehicle_id: snapshot.prev_vehicle_id,
    });
  },
);

/**
 * Step opcional: marca el driver como 'on_route'. Compensación: lo vuelve a
 * 'available'. No bloquea el flujo si el driver desapareció.
 */
const markDriverOnRouteStep = createStep(
  'mark-driver-on-route',
  async (
    input: { driver_id: string; enabled: boolean },
    { container },
  ) => {
    if (!input.enabled) {
      return new StepResponse({ updated: false }, null);
    }
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const driver = (await service
      .retrieveDriver(input.driver_id)
      .catch(() => null)) as UnknownRecord | null;
    const prevStatus = driver ? String(driver.status) : null;
    if (driver) {
      await service.updateDrivers({ id: input.driver_id, status: 'on_route' });
    }
    return new StepResponse(
      { updated: Boolean(driver) },
      prevStatus ? { driver_id: input.driver_id, prev_status: prevStatus } : null,
    );
  },
  async (
    comp: { driver_id: string; prev_status: string } | null | undefined,
    { container },
  ) => {
    if (!comp) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    await service.updateDrivers({
      id: comp.driver_id,
      status: comp.prev_status,
    });
  },
);

/**
 * Step best-effort: mete la ejecución en la ruta del driver para el día. Invoca
 * attach-execution-to-route por su API .run() con el mismo container (el SDK no
 * permite condicionales dinámicos sobre runAsStep; mismo patrón que dispatch-route).
 *
 * DECISIÓN — best-effort, NO transaccional: la asignación (driver_id/vehicle_id +
 * transición a 'assigned') ya ocurrió y es lo CRÍTICO. La ruta es un artefacto
 * DERIVADO; un fallo al rutear NO debe revertir la asignación. Por eso el invoke
 * va envuelto en try/catch y solo loguea. No declara compensación: si este step
 * fallara igual no haría rollback de la asignación (que es el objetivo).
 */
const attachToRouteStep = createStep(
  'assign-delivery-attach-to-route',
  async (
    input: {
      enabled: boolean;
      execution_id: string;
      driver_id: string;
      vehicle_id?: string;
    },
    { container },
  ) => {
    if (!input.enabled) {
      return new StepResponse({ attached: false });
    }
    try {
      const { result } = await attachExecutionToRouteWorkflow(container).run({
        input: {
          execution_id: input.execution_id,
          driver_id: input.driver_id,
          vehicle_id: input.vehicle_id ?? null,
        },
      });
      return new StepResponse({ attached: result.attached });
    } catch (err) {
      // Best-effort: la asignación es lo crítico; el ruteo es derivado.
      const logger = container.resolve('logger') as {
        error: (msg: string) => void;
      };
      logger.error(
        `[assign-delivery] attach-execution-to-route falló para execution ${
          input.execution_id
        }: ${err instanceof Error ? err.message : String(err)}`,
      );
      return new StepResponse({ attached: false });
    }
  },
);

export const assignDeliveryWorkflow = createWorkflow(
  'assign-delivery',
  (input: AssignDeliveryInput) => {
    // 1+2) Valida no-terminal + asigna (persiste driver_id/vehicle_id).
    const snapshot = assignViaProviderStep(input);

    // 3) Transiciona a 'assigned' emitiendo un evento de sistema. 'assigned' no
    // es hito comercial → transition-delivery-execution NO proyecta a Medusa.
    const transitionInput = transform({ input }, ({ input }) => ({
      execution_id: input.execution_id,
      to_status: 'assigned' as const,
      event: {
        source: 'system' as const,
        code: 'assigned' as const,
        description: `Asignada a driver ${input.driver_id}${
          input.vehicle_id ? ` / vehicle ${input.vehicle_id}` : ''
        }`,
      },
    }));
    transitionDeliveryExecutionWorkflow.runAsStep({ input: transitionInput });

    // 4) (Opcional) driver → on_route.
    const onRouteInput = transform({ input }, ({ input }) => ({
      driver_id: input.driver_id,
      enabled: input.set_driver_on_route !== false,
    }));
    markDriverOnRouteStep(onRouteInput);

    // 5) (Opcional) attach a la ruta del driver/día. Best-effort: no tumba el
    // assign si falla. Default false → dispatch-route y otros callers quedan
    // intactos.
    const attachInput = transform({ input }, ({ input }) => ({
      enabled: input.attach_to_route === true,
      execution_id: input.execution_id,
      driver_id: input.driver_id,
      vehicle_id: input.vehicle_id,
    }));
    attachToRouteStep(attachInput);

    return new WorkflowResponse(
      transform({ snapshot, input }, ({ snapshot, input }) => ({
        execution_id: snapshot.execution_id,
        driver_id: input.driver_id,
        vehicle_id: input.vehicle_id ?? null,
        status: 'assigned' as const,
      })),
    );
  },
);

export default assignDeliveryWorkflow;
