import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../../modules/recurring-order/service';
import { retrievePlanBundle } from '../../../../../../modules/recurring-order/plans';
import { siteFromRequest } from '../../../../../../lib/multistore';
import { assertRowInSite } from '../../../../../../lib/multistore/scope';
import { SUBSCRIPTION_PLAN_SITE_SCOPE } from '../../../../../../modules/recurring-order/site-scope';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const id = req.params.plan_id as string;
  const plan: any = await service.retrieveSubscriptionPlan(id);
  assertRowInSite(plan, await siteFromRequest(req), SUBSCRIPTION_PLAN_SITE_SCOPE);
  const offers = await service.listSubscriptionPlanOffers({ plan_id: id, enabled: true });
  const targets = await service.listSubscriptionTargets({ plan_id: id, enabled: true });
  if (!offers.length || !targets.length) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'El plan necesita frecuencias y productos antes de publicarse.');
  if (plan.status === 'archived') throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Un plan archivado no se puede publicar.');
  const previous = await service.listSubscriptionPlans({ sales_channel_id: plan.sales_channel_id, handle: plan.handle, status: 'active' });
  for (const row of previous) {
    if (row.id !== id) await service.updateSubscriptionPlans([{ id: row.id, status: 'archived', archived_at: new Date() }]);
  }
  await service.updateSubscriptionPlans([{ id, status: 'active', published_at: new Date() }]);
  res.status(200).json(await retrievePlanBundle(service, id));
}
