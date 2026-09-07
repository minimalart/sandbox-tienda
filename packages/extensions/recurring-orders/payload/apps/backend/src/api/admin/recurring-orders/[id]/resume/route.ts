import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { MedusaError } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECURRING_ORDER_SITE_SCOPE } from '../../../../../modules/recurring-order/site-scope';
import { RECURRING_ORDER_MODULE } from '../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../modules/recurring-order/service';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';

const Body = z.object({ next_execution_at: z.string().datetime().nullish() });

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: reanudar la suscripción de otra tienda es tan caro como
  // pausarla, y encima acepta `next_execution_at` — o sea que además de reactivarla
  // decide CUÁNDO se le vuelve a cobrar al cliente ajeno.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECURRING_ORDER_SITE_SCOPE, req.params.id as string);

  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const current = await service.retrieveRecurringOrder(req.params.id as string);
  if (current.payment_mode === 'mercadopago_auto' && parsed.data.next_execution_at) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Reanudar no cambia la fecha autorizada. La nueva agenda requiere reautorización del cliente.',
    );
  }
  const recurring_order = await service.resumeRecurringOrder(
    req.params.id as string,
    parsed.data.next_execution_at ? new Date(parsed.data.next_execution_at) : null,
  );
  await enqueueSubscriptionCommunication(
    req.scope, recurring_order, 'recurring-order-resumed', {}, `recurring-order-resumed:${Date.now()}`,
  );
  await service.log({
    recurring_order_id: req.params.id as string,
    event: 'resumed',
    actor_type: 'admin',
    actor_id: (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null,
  });
  res.status(200).json({ recurring_order });
  });
}
