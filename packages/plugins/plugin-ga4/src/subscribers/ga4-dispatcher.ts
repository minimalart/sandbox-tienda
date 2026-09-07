import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { GA4_MODULE } from '../modules/ga4';
import type Ga4ModuleService from '../modules/ga4/service';
import { SUPPORTED_EVENT_NAMES } from '../modules/ga4/lib/supported-events';

/**
 * Despacha eventos GENÉRICOS (mapeos medusa_event → ga4_event definidos por el
 * usuario) a GA4 server-side vía Measurement Protocol. Los eventos del embudo
 * ecommerce los maneja ga4-ecommerce-dispatcher.ts. Si faltan las credenciales
 * hace no-op; nunca lanza (cualquier fallo se loguea).
 */
export default async function ga4DispatcherHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    // Igual que dynamic-groups.ts: el nombre del evento disparado vive en
    // event.name; los datos en event.data.
    const eventName = event.name;

    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    // No-op cuando el tracking server-side no está configurado (config en DB).
    if (!(await ga4Service.isConfigured())) {
      return;
    }

    const mappings = await ga4Service.listActiveMappings(eventName);

    for (const mapping of mappings) {
      await ga4Service.dispatch(mapping, event.data);
    }
  } catch (error) {
    logger.warn(
      `[GA4] No se pudo despachar evento (${event.name}): ${(error as Error).message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: SUPPORTED_EVENT_NAMES,
};
