import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';
import { MedusaError } from '@medusajs/framework/utils';
import { ownedRecurringOrder } from '../../utils';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';

const Body = z.object({ next_execution_at: z.string().datetime().nullish() });

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);
  if (recurringOrder.payment_mode === 'mercadopago_auto' && parsed.data.next_execution_at) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Reanudar no cambia la fecha autorizada. Para elegir otra fecha, cambiá la frecuencia y confirmá la nueva autorización.',
    );
  }
  const updated = await service.resumeRecurringOrder(
    recurringOrder.id,
    parsed.data.next_execution_at ? new Date(parsed.data.next_execution_at) : null,
  );
  await enqueueSubscriptionCommunication(
    req.scope, updated, 'recurring-order-resumed', {}, `recurring-order-resumed:${Date.now()}`,
  );
  await service.log({
    recurring_order_id: recurringOrder.id,
    event: 'resumed',
    actor_type: 'customer',
    actor_id: req.auth_context.actor_id,
  });
  res.status(200).json({ recurring_order: updated });
  });
}
