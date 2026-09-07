import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECURRING_ORDER_SITE_SCOPE } from '../../../../../modules/recurring-order/site-scope';
import { RECURRING_ORDER_MODULE } from '../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../modules/recurring-order/service';
import { syncMercadoPagoSubscriptionStatus } from '../../../../../modules/recurring-order/payment';
import { releaseRecurringOrderReservations } from '../../../../../modules/recurring-order/inventory-reservations';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';

const Body = z.object({ reason: z.string().max(500).nullish() });

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: pausar o cancelar la suscripción de otra tienda le corta la
  // entrega a un cliente que no es de quien la cancela.
  //
  // De las cuatro acciones del recurso ésta es la única IRREVERSIBLE: `cancelRecurringOrder`
  // deja el caso de cancelación asentado y el cliente tiene que volver a suscribirse.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECURRING_ORDER_SITE_SCOPE, req.params.id as string);

  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const current = await service.retrieveRecurringOrder(req.params.id as string);
  await syncMercadoPagoSubscriptionStatus(req.scope, current, 'cancelled');
  await releaseRecurringOrderReservations(req.scope, current.id);
  const recurring_order = await service.cancelRecurringOrder(
    req.params.id as string,
    parsed.data.reason ?? null,
  );
  await enqueueSubscriptionCommunication(req.scope, recurring_order, 'recurring-order-cancelled', {
    cancellation_reason: parsed.data.reason ?? undefined,
  });
  await service.log({
    recurring_order_id: req.params.id as string,
    event: 'cancelled',
    actor_type: 'admin',
    actor_id: (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null,
  });
  res.status(200).json({ recurring_order });
  });
}
