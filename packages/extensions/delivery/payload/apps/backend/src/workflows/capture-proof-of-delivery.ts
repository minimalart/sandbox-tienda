/**
 * capture-proof-of-delivery (M5) — registra una evidencia de entrega
 * (ProofOfDelivery) para una DeliveryExecution.
 *
 * Tipos soportados (input.type):
 *  - 'photo'     → file_url (ya subido vía el endpoint de upload del driver).
 *  - 'signature' → signature_url (idem).
 *  - 'geo'       → lat/lng de la captura.
 *  - 'note'      → note de texto.
 *  - 'pin'       → valida el PIN del CDE contra store_location.delivery_pin
 *                  REUSANDO validateDeliveryPin (NO duplica la lógica del flujo
 *                  validate-pickup). `pin_validated` = resultado. Si el PIN es
 *                  inválido lanza NOT_ALLOWED y NO crea el POD.
 *
 * El POD se persiste vía service.addProofOfDelivery, que además appendea un
 * TrackingEvent 'proof_captured' al timeline. Capturar el POD ANTES de
 * transicionar a 'delivered' es lo que habilita la entrega de flota propia
 * (el gating de transition() consulta hasProofOfDelivery).
 *
 * Este workflow NO transiciona ni proyecta a Medusa: solo captura evidencia.
 * La transición la dispara driver-delivery-action / transition-delivery-execution.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import type { ProofType } from '../modules/delivery/types';
import { validateDeliveryPin } from './validate-delivery-pin';

export interface CaptureProofOfDeliveryInput {
  execution_id: string;
  type: ProofType;
  file_url?: string;
  signature_url?: string;
  lat?: number;
  lng?: number;
  captured_by?: string;
  note?: string;
  /** Requeridos para type 'pin': PIN ingresado + sucursal contra la que validar. */
  pin?: number | string;
  store_location_id?: string;
}

interface CapturedProof {
  id: string;
  delivery_execution_id: string;
  type: string;
  pin_validated: boolean | null;
}

const captureProofStep = createStep(
  'capture-proof-of-delivery',
  async (input: CaptureProofOfDeliveryInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    let pinValidated: boolean | null = null;

    // type 'pin': validar contra store_location.delivery_pin (lógica compartida
    // con validate-pickup). Sin PIN válido NO se crea el POD.
    if (input.type === 'pin') {
      if (input.pin === undefined || input.pin === null || !input.store_location_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Para un ProofOfDelivery type 'pin' se requieren 'pin' y 'store_location_id'.",
        );
      }
      pinValidated = await validateDeliveryPin(
        container,
        input.store_location_id,
        input.pin,
      );
      if (!pinValidated) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'PIN de entrega inválido.',
        );
      }
    }

    const pod = await service.addProofOfDelivery({
      delivery_execution_id: input.execution_id,
      type: input.type,
      file_url: input.file_url ?? null,
      signature_url: input.signature_url ?? null,
      captured_lat: typeof input.lat === 'number' ? input.lat : null,
      captured_lng: typeof input.lng === 'number' ? input.lng : null,
      captured_by: input.captured_by ?? null,
      pin_validated: pinValidated,
      note: input.note ?? null,
      metadata: input.store_location_id
        ? { store_location_id: input.store_location_id }
        : null,
    });

    const result: CapturedProof = {
      id: pod.id,
      delivery_execution_id: pod.delivery_execution_id,
      type: pod.type,
      pin_validated: (pod.pin_validated as boolean | null) ?? null,
    };

    // Compensación: si un paso posterior falla, borramos el POD recién creado.
    return new StepResponse(result, result.id);
  },
  async (podId, { container }) => {
    if (!podId) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    await service.deleteProofOfDeliveries(podId).catch(() => {
      // best-effort: no romper la compensación si el POD ya no existe.
    });
  },
);

export const captureProofOfDeliveryWorkflow = createWorkflow(
  'capture-proof-of-delivery',
  (input: CaptureProofOfDeliveryInput) => {
    const proof = captureProofStep(input);
    return new WorkflowResponse(proof);
  },
);

export default captureProofOfDeliveryWorkflow;
