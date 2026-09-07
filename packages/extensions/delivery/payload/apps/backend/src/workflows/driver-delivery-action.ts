/**
 * driver-delivery-action — acciones del repartidor (PWA flota propia) sobre una
 * DeliveryExecution asignada.
 *
 * Mapea la acción del driver a un to_status de la state machine y dispara
 * transition-delivery-execution con un evento source='driver' (code + location +
 * note). Eso produce dos efectos en cadena (ambos en transition-delivery):
 *  - se appendea un TrackingEvent source='driver' con la geolocalización,
 *  - en pickup → 'picked_up' (hito de salida) y en delivered → 'delivered' se
 *    PROYECTA a Medusa (createOrderShipmentWorkflow / markFulfillmentAsDelivered).
 *
 * Validación de ownership: el driver_id recibido DEBE coincidir con el
 * driver_id asignado a la ejecución. Si no, NOT_ALLOWED.
 *
 * Mapa acción → to_status:
 *   pickup        → picked_up
 *   in_transit    → in_transit
 *   delivered     → delivered
 *   failed_attempt→ failed_attempt
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import type { DeliveryExecutionStatus, ProofType } from '../modules/delivery/types';
import type { TrackingEventLocation } from '../modules/delivery/tracking-types';
import { transitionDeliveryExecutionWorkflow } from './transition-delivery-execution';
import { captureProofOfDeliveryWorkflow } from './capture-proof-of-delivery';

export type DriverAction =
  | 'pickup'
  | 'in_transit'
  | 'delivered'
  | 'failed_attempt';

/**
 * Evidencia de entrega que el repartidor adjunta a la acción 'delivered'.
 * file_url / signature_url ya vienen subidos (endpoint de upload del driver);
 * acá solo se referencian las URLs. La geo se toma de input.location si no se
 * pasa explícita.
 */
export interface DriverProofInput {
  type: ProofType;
  file_url?: string;
  signature_url?: string;
  note?: string;
}

export interface DriverDeliveryActionInput {
  execution_id: string;
  action: DriverAction;
  driver_id: string;
  location?: TrackingEventLocation;
  note?: string;
  /** Evidencia de entrega (M5). Obligatoria para 'delivered' en flota propia. */
  proof?: DriverProofInput;
}

type UnknownRecord = Record<string, unknown>;

/** Acción del driver → estado destino de la state machine + code del evento. */
const ACTION_TO_STATUS: Record<DriverAction, DeliveryExecutionStatus> = {
  pickup: 'picked_up',
  in_transit: 'in_transit',
  delivered: 'delivered',
  failed_attempt: 'failed_attempt',
};

interface OwnershipResult {
  execution_id: string;
  to_status: DeliveryExecutionStatus;
}

/**
 * Valida ownership: la ejecución debe estar asignada al driver_id que ejecuta la
 * acción. Resuelve el to_status desde la acción.
 */
const validateOwnershipStep = createStep(
  'validate-driver-ownership',
  async (input: DriverDeliveryActionInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    const execution = (await service
      .retrieveDeliveryExecution(input.execution_id)
      .catch(() => null)) as UnknownRecord | null;
    if (!execution) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `DeliveryExecution ${input.execution_id} no existe.`,
      );
    }

    const assignedDriverId = (execution.driver_id as string | null) ?? null;
    if (!assignedDriverId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `DeliveryExecution ${input.execution_id} no tiene driver asignado.`,
      );
    }
    if (assignedDriverId !== input.driver_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `El driver ${input.driver_id} no está asignado a la DeliveryExecution ${input.execution_id}.`,
      );
    }

    const toStatus = ACTION_TO_STATUS[input.action];
    if (!toStatus) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Acción de driver inválida: '${input.action}'.`,
      );
    }

    const result: OwnershipResult = {
      execution_id: input.execution_id,
      to_status: toStatus,
    };
    return new StepResponse(result);
  },
);

export const driverDeliveryActionWorkflow = createWorkflow(
  'driver-delivery-action',
  (input: DriverDeliveryActionInput) => {
    const ownership = validateOwnershipStep(input);

    // POD (M5): en 'delivered' capturamos la evidencia ANTES de transicionar,
    // para que el gating de service.transition() (flota propia exige POD) pase.
    // Si la action es 'delivered' pero no llega `proof`, capture-proof recibe un
    // type vacío y falla con INVALID_DATA — el driver DEBE adjuntar evidencia.
    // Para acciones != delivered no se captura nada.
    when({ input }, ({ input }) => input.action === 'delivered').then(() => {
      const proofInput = transform({ input }, ({ input }) => {
        const proof = input.proof;
        return {
          execution_id: input.execution_id,
          // Si no vino proof, mandamos un type vacío: capture-proof valida con
          // isValidProofType y lanza INVALID_DATA. El route ya rechaza esto antes
          // (refine en StoreDriverActionSchema); esto es la red de seguridad.
          type: (proof?.type ?? ('' as ProofType)),
          file_url: proof?.file_url,
          signature_url: proof?.signature_url,
          lat: input.location?.lat,
          lng: input.location?.lng,
          captured_by: input.driver_id,
          note: proof?.note ?? input.note,
        };
      });
      captureProofOfDeliveryWorkflow.runAsStep({ input: proofInput });
    });

    // Transiciona con un evento source='driver'. transition-delivery-execution
    // appendea el TrackingEvent (con location) y proyecta a Medusa en los hitos
    // comerciales (picked_up/in_transit → shipped, delivered → delivered).
    const transitionInput = transform(
      { ownership, input },
      ({ ownership, input }) => ({
        execution_id: ownership.execution_id,
        to_status: ownership.to_status as string,
        event: {
          source: 'driver' as const,
          code: ownership.to_status as string,
          location: input.location ?? null,
          description: input.note ?? null,
        },
      }),
    );
    transitionDeliveryExecutionWorkflow.runAsStep({ input: transitionInput });

    return new WorkflowResponse(
      transform({ ownership, input }, ({ ownership, input }) => ({
        execution_id: ownership.execution_id,
        action: input.action,
        status: ownership.to_status,
        driver_id: input.driver_id,
      })),
    );
  },
);

export default driverDeliveryActionWorkflow;
