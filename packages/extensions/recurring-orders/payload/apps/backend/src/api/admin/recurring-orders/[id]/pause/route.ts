import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECURRING_ORDER_SITE_SCOPE } from '../../../../../modules/recurring-order/site-scope';
import { RECURRING_ORDER_MODULE } from '../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../modules/recurring-order/service';
import { syncMercadoPagoSubscriptionStatus } from '../../../../../modules/recurring-order/payment';
import {
  releaseRecurringOrderReservations,
  resetAutomaticCyclesAfterPause,
} from '../../../../../modules/recurring-order/inventory-reservations';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: pausar o cancelar la suscripción de otra tienda le corta la
  // entrega a un cliente que no es de quien la pausa. Y pausar no avisa a nadie: la
  // suscripción simplemente deja de renovar, así que el dueño lo ve cuando el cliente
  // reclama que no le llegó el pedido del mes.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECURRING_ORDER_SITE_SCOPE, req.params.id as string);

  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const current = await service.retrieveRecurringOrder(req.params.id as string);
  await syncMercadoPagoSubscriptionStatus(req.scope, current, 'paused');
  await releaseRecurringOrderReservations(req.scope, current.id);
  if (current.payment_mode === 'mercadopago_auto') {
    await resetAutomaticCyclesAfterPause(req.scope, current.id);
  }
  const recurring_order = await service.pauseRecurringOrder(req.params.id as string);
  await enqueueSubscriptionCommunication(
    req.scope, recurring_order, 'recurring-order-paused', {}, `recurring-order-paused:${Date.now()}`,
  );
  await service.log({
    recurring_order_id: req.params.id as string,
    event: 'paused',
    actor_type: 'admin',
    actor_id: (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null,
  });
  res.status(200).json({ recurring_order });
  });
}
