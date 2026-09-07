/**
 * Registry de DeliveryProviders.
 *
 * Mapea `provider_type` (el de la DeliveryExecution) → instancia de
 * AbstractDeliveryProvider. Resuelto lazy y cacheado por container: cada
 * provider necesita el container para resolver sus dependencias (Andreani
 * client por ENV, query.graph, logger) y ejecutar workflows.
 *
 * Diseño:
 *  - `register(type, ctor)` registra la clase del provider (no la instancia).
 *  - `get(type, container)` instancia (o devuelve la cacheada) pasándole el
 *    container vía DeliveryProviderContext.
 *  - El cache es por container para no compartir estado entre requests/scopes.
 */

import type { MedusaContainer } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';
import type { AbstractDeliveryProvider } from './abstract-delivery-provider';
import type { DeliveryProviderContext } from './types';
import { AndreaniDeliveryProvider } from './andreani';
import { CorreoArgentinoDeliveryProvider } from './correo-argentino';
import { OwnFleetDeliveryProvider } from './own-fleet';

/** Constructor de un provider concreto. */
type ProviderCtor = (new (
  context: DeliveryProviderContext,
) => AbstractDeliveryProvider) & {
  identifier: string;
};

/** Tabla de providers registrados (clase, no instancia). */
const PROVIDER_CTORS = new Map<string, ProviderCtor>();

/** Cache de instancias por container. */
const INSTANCE_CACHE = new WeakMap<
  MedusaContainer,
  Map<string, AbstractDeliveryProvider>
>();

/** Registra la clase de un provider bajo su provider_type. */
export function registerDeliveryProvider(ctor: ProviderCtor): void {
  PROVIDER_CTORS.set(ctor.identifier, ctor);
}

/** True si hay un provider registrado para ese provider_type. */
export function hasDeliveryProvider(providerType: string): boolean {
  return PROVIDER_CTORS.has(providerType);
}

/**
 * Resuelve (lazy, cacheado por container) el provider para un provider_type.
 * Lanza NOT_FOUND si no hay provider registrado.
 */
export function getDeliveryProvider(
  providerType: string,
  container: MedusaContainer,
): AbstractDeliveryProvider {
  const ctor = PROVIDER_CTORS.get(providerType);
  if (!ctor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No hay DeliveryProvider registrado para provider_type '${providerType}'.`,
    );
  }

  let perContainer = INSTANCE_CACHE.get(container);
  if (!perContainer) {
    perContainer = new Map();
    INSTANCE_CACHE.set(container, perContainer);
  }

  const cached = perContainer.get(providerType);
  if (cached) return cached;

  const instance = new ctor({ container });
  perContainer.set(providerType, instance);
  return instance;
}

// --- Providers built-in ---
// Se registran al importar el módulo. `store_pickup` aún no tiene adapter (M3+);
// los dos carriers ('andreani', 'correo_argentino') y 'own_fleet' sí.
//
// El registro es incondicional a propósito, aunque el provider de fulfillment
// de Correo esté gateado por env: acá solo se registra la CLASE. Sin
// credenciales nunca se crea una DeliveryExecution con
// provider_type 'correo_argentino', así que el adapter jamás se instancia.
registerDeliveryProvider(AndreaniDeliveryProvider);
registerDeliveryProvider(CorreoArgentinoDeliveryProvider);
registerDeliveryProvider(OwnFleetDeliveryProvider);
