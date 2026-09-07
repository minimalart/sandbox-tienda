import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';
import { createPlanVersion, retrievePlanBundle } from '../../../../modules/recurring-order/plans';
import { planChannelForSite } from '../../../../modules/recurring-order/plan-site';
import { siteChannelFilter, siteFromRequest } from '../../../../lib/multistore';
import { PlanBody } from './validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const filters: Record<string, unknown> = siteChannelFilter(
    await siteFromRequest(req),
    req.query.sales_channel_id as string | undefined,
  );
  if (req.query.status) filters.status = String(req.query.status).split(',');
  const [plans, count] = await service.listAndCountSubscriptionPlans(filters, {
    take: limit,
    skip: offset,
    order: { updated_at: 'DESC' },
  });
  const bundles = await Promise.all(plans.map(async (plan: any) => {
    const bundle = await retrievePlanBundle(service, plan.id);
    const [, impacted] = await service.listAndCountRecurringOrders(
      { plan_id: plan.id, status: ['active', 'paused', 'pending_payment', 'failed'] },
      { take: 1 },
    );
    return { ...bundle, impacted_subscriptions: impacted };
  }));
  res.status(200).json({ plans: bundles, count, limit, offset });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos invalidos.' });
    return;
  }
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const resolution = await siteFromRequest(req);
  const plan = await createPlanVersion(service, {
    ...parsed.data,
    sales_channel_id: planChannelForSite(resolution, parsed.data.sales_channel_id),
    currency_code: parsed.data.currency_code?.toLowerCase() ?? null,
  });
  res.status(201).json(await retrievePlanBundle(service, plan.id));
}
