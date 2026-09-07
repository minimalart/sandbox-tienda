import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { GA4_MODULE } from '../modules/ga4';
import type Ga4ModuleService from '../modules/ga4/service';
import { BUILTIN_TRIGGER_EVENTS } from '../modules/ga4/lib/supported-events';

/**
 * Dispatcher de los eventos del embudo ecommerce (portados del plugin
 * @variablevic/google-analytics-medusa, ahora desactivado). Escucha los eventos
 * Medusa que los disparan y enruta al built-in correspondiente. Cada built-in
 * chequea su propio setting (activo + nombre GA4) en el servicio.
 *
 * No-op si falta el measurement id o el api secret, sea cual sea su origen
 * (card de app-settings, fila legacy `ga4_settings` o env). Nunca lanza.
 */
export default async function ga4EcommerceDispatcherHandler({
  event,
  container,
}: SubscriberArgs<{ id: string; changes?: any; payment_session?: any }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const ga4Service: Ga4ModuleService = container.resolve(GA4_MODULE);

    // No-op cuando el tracking server-side no está configurado (config en DB).
    if (!(await ga4Service.isConfigured())) {
      return;
    }

    const data = event.data;

    switch (event.name) {
      case 'order.placed':
        await ga4Service.dispatchBuiltin('purchase', data, container);
        break;

      case 'payment-session.created':
        await ga4Service.dispatchBuiltin('add_payment_info', data, container);
        break;

      case 'payment.refunded':
        await ga4Service.dispatchBuiltin('refund', data, container);
        break;

      case 'cart.updated': {
        const changes = data.changes;
        if (changes?.line_items) {
          if (changes.line_items.action === 'added') {
            await ga4Service.dispatchBuiltin('add_to_cart', data, container);
          } else if (changes.line_items.action === 'deleted') {
            await ga4Service.dispatchBuiltin('remove_from_cart', data, container);
          }
        } else if (changes?.shipping_address) {
          await ga4Service.dispatchBuiltin('add_shipping_info', data, container);
        }
        break;
      }
    }
  } catch (error) {
    logger.warn(
      `[GA4] No se pudo despachar evento ecommerce (${event.name}): ${(error as Error).message}`
    );
  }
}

export const config: SubscriberConfig = {
  event: BUILTIN_TRIGGER_EVENTS,
};
