import type { AuthenticatedMedusaRequest } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../modules/recurring-order/service';
import {
  channelsFromPublishableKey,
  siteFromPublishableKey,
} from '../../../lib/multistore/publishable-key';

/**
 * Trae la suscripción validando que pertenezca al customer autenticado.
 * Devuelve 404 (no 403) para no revelar existencia de recursos ajenos.
 */
export async function ownedRecurringOrder(
  req: AuthenticatedMedusaRequest,
  id: string,
): Promise<{ service: RecurringOrderModuleService; recurringOrder: any }> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  let recurringOrder: any;
  try {
    recurringOrder = await service.retrieveRecurringOrder(id);
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Suscripción no encontrada.');
  }
  if (recurringOrder.customer_id !== req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Suscripción no encontrada.');
  }
  await siteFromPublishableKey(req);
  const allowedChannels = channelsFromPublishableKey(req);
  if (allowedChannels.length && !allowedChannels.includes(recurringOrder.sales_channel_id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Suscripción no encontrada.');
  }
  return { service, recurringOrder };
}
