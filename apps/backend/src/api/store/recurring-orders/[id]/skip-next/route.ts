import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ownedRecurringOrder } from '../../utils';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';
import { skipNextRecurringOrderDelivery } from '../../../../../modules/recurring-order/actions';

/** Omite la próxima entrega (una sola vez). El scheduler consume el flag. */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);
  const result = await skipNextRecurringOrderDelivery(req.scope, service, recurringOrder);
  const updated = result.recurringOrder;
  await service.log({
    recurring_order_id: recurringOrder.id,
    event: 'skip_set',
    actor_type: 'customer',
    actor_id: req.auth_context.actor_id,
  });
  await enqueueSubscriptionCommunication(
    req.scope,
    updated,
    'recurring-order-skipped',
    { next_execution: updated.next_billing_at ?? updated.next_execution_at ?? undefined },
    `recurring-order-skipped:${new Date().toISOString().slice(0, 10)}`,
  );
  res.status(200).json({
    recurring_order: updated,
    ...(result.authorizationUrl ? { authorization_url: result.authorizationUrl } : {}),
  });
  });
}
