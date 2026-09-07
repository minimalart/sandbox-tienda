import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../../lib/multistore/scope';
import { RECURRING_ORDER_SITE_SCOPE } from '../../../../../../../modules/recurring-order/site-scope';
import { RECURRING_ORDER_MODULE } from '../../../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../../../modules/recurring-order/service';
import { syncMercadoPagoSubscriptionStatus } from '../../../../../../../modules/recurring-order/payment';
import { withSubscriptionLock } from '../../../../../../../workflows/run-renewal-cycle';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params.id as string;
  await assertIdInSite(
    req.scope,
    await siteFromRequest(req),
    RECURRING_ORDER_SITE_SCOPE,
    orderId,
  );
  await withSubscriptionLock(
    req.scope,
    [`order:${orderId}`, `renewal:${req.params.cycle_id as string}`],
    async () => {
      const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
      const recurringOrder: any = await service.retrieveRecurringOrder(orderId);
      const cycle: any = await service.retrieveRenewalCycle(req.params.cycle_id as string);
      if (cycle.recurring_order_id !== orderId || cycle.status !== 'past_due') {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'El ciclo no tiene un cobro recuperable pendiente.',
        );
      }
      const now = new Date();
      await service.updateRenewalCycles([{
        id: cycle.id,
        status: 'awaiting_charge',
        scheduled_at: now,
        last_error: null,
      }]);
      try {
        await syncMercadoPagoSubscriptionStatus(req.scope, recurringOrder, 'authorized');
      } catch (error) {
        await service.updateRenewalCycles([{
          id: cycle.id,
          status: 'past_due',
          scheduled_at: cycle.scheduled_at,
          last_error: cycle.last_error,
        }]);
        throw error;
      }
      await service.log({
        recurring_order_id: orderId,
        event: 'payment_retry_requested',
        actor_type: 'admin',
        actor_id: (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null,
        data: { cycle_id: cycle.id },
      });
      res.status(202).json({ cycle_id: cycle.id, status: 'awaiting_charge' });
    },
  );
}
