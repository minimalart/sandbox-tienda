/**
 * validate-delivery-pin — helper COMPARTIDO de validación de PIN del CDE.
 *
 * El PIN de entrega vive en `store_location.delivery_pin` (un número de 6
 * dígitos, seteado server-side por sucursal). El flujo de retiro en CDE
 * (storefront /validar-entrega → backend /store/orders/:id/validate-pickup)
 * compara el PIN ingresado contra el `delivery_pin` de la sucursal elegida.
 *
 * Esta función centraliza ESA comparación para que:
 *  - el workflow capture-proof-of-delivery (POD type 'pin') la reuse,
 *  - el endpoint validate-pickup (cuando se porte/exista en este backend) la
 *    reuse en lugar de duplicar la lógica.
 *
 * NO lanza si el PIN es inválido: devuelve `false`. El caller decide el shape
 * del error (el flujo CDE usa códigos como 'invalid_pin'). Sí lanza si la
 * sucursal no existe (dato inconsistente).
 */

import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import {
  STORE_LOCATION_MODULE,
} from '../modules/store-location';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';

interface StoreLocationModuleServiceLike {
  retrieveStoreLocation: (
    id: string,
    config?: unknown,
  ) => Promise<{ id: string; delivery_pin?: number | null } & Record<string, unknown>>;
}

/** Normaliza un PIN entrante (number | string numérico) a number, o null. */
const normalizePin = (pin: unknown): number | null => {
  if (typeof pin === 'number' && Number.isFinite(pin)) return pin;
  if (typeof pin === 'string') {
    const trimmed = pin.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Valida un PIN de entrega contra el `delivery_pin` de una sucursal.
 *
 * @returns `true` si el PIN coincide; `false` si no coincide o la sucursal no
 *   tiene PIN configurado.
 * @throws NOT_FOUND si la sucursal no existe.
 */
export async function validateDeliveryPin(
  container: MedusaContainer,
  storeLocationId: string,
  pin: number | string,
): Promise<boolean> {
  const normalized = normalizePin(pin);
  if (normalized === null) return false;

  const storeLocationService =
    container.resolve<StoreLocationModuleServiceLike>(STORE_LOCATION_MODULE);

  const location = await storeLocationService
    .retrieveStoreLocation(storeLocationId)
    .catch(() => null);

  if (!location) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Sucursal ${storeLocationId} no existe.`,
    );
  }

  const expected = location.delivery_pin;
  if (typeof expected !== 'number') {
    // La sucursal no tiene PIN configurado → no se puede validar.
    return false;
  }

  return expected === normalized;
}

/**
 * UNIFICACIÓN DEL PIN CDE COMO POD (M5).
 *
 * Registra de forma ADITIVA un ProofOfDelivery type 'pin' para la
 * DeliveryExecution de una orden, tras una validación de PIN exitosa en el flujo
 * de retiro en CDE (validate-pickup).
 *
 * Está pensada para llamarse desde el endpoint validate-pickup JUSTO DESPUÉS de
 * validar el PIN y marcar la entrega, SIN cambiar su comportamiento: si algo
 * sale mal (no hay execution para la orden — datos viejos —, o falla la
 * persistencia), NO lanza: loguea y sigue. El POD es un side-effect de
 * trazabilidad, no debe romper la entrega.
 *
 * Resuelve la execution vía el link delivery_execution ↔ order
 * (order.delivery_executions). Si la orden tiene varias ejecuciones, toma la
 * primera (el retiro CDE es 1 fulfillment / 1 execution en la práctica).
 *
 * Uso sugerido en el route de validate-pickup (aditivo, al final del happy path):
 *
 *   await recordPickupPinProof(req.scope, {
 *     order_id: orderId,
 *     store_location_id: storeLocationId,
 *     captured_by: operatorUserId,
 *   });
 */
export async function recordPickupPinProof(
  container: MedusaContainer,
  input: {
    order_id: string;
    store_location_id?: string;
    captured_by?: string | null;
  },
): Promise<{ proof_id: string } | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: orders } = await query.graph({
      entity: 'order',
      fields: ['id', 'delivery_executions.id'],
      filters: { id: input.order_id },
    });

    const order = orders?.[0] as
      | { delivery_executions?: Array<{ id?: string }> }
      | undefined;
    const executionId = order?.delivery_executions?.find((e) => e?.id)?.id;

    // Sin execution (datos viejos / orden sin capa de ejecución): no rompemos.
    if (!executionId) {
      return null;
    }

    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const pod = await service.addProofOfDelivery({
      delivery_execution_id: executionId,
      type: 'pin',
      pin_validated: true,
      captured_by: input.captured_by ?? null,
      metadata: input.store_location_id
        ? { store_location_id: input.store_location_id }
        : null,
    });

    return { proof_id: pod.id };
  } catch (error) {
    console.error('[validate-pickup] No se pudo registrar el POD pin:', error);
    return null;
  }
}
