import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECURRING_ORDER_SITE_SCOPE } from '../../../../../modules/recurring-order/site-scope';
import { RECURRING_ORDER_MODULE } from '../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../modules/recurring-order/service';
import { retrieveMercadoPagoSubscription } from '../../../../../modules/recurring-order/payment';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  await assertIdInSite(req.scope, await siteFromRequest(req), RECURRING_ORDER_SITE_SCOPE, id);
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const recurringOrder: any = await service.retrieveRecurringOrder(id);
  const external = await retrieveMercadoPagoSubscription(req.scope, recurringOrder);
  if (external) {
    await service.updateRecurringOrders([{
      id,
      financial_status: external.status ?? recurringOrder.financial_status,
      provider_state: {
        status: external.status ?? null,
        next_payment_date: external.next_payment_date ?? null,
        synced_at: new Date().toISOString(),
      },
    }]);
    await service.log({
      recurring_order_id: id,
      event: 'provider_reconciled',
      actor_type: 'admin',
      actor_id: (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null,
      data: { provider_status: external.status ?? null },
    });
  }
  res.status(200).json({ provider: external ?? null });
}
