import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../modules/recurring-order/service';
import { createPlanVersion, retrievePlanBundle } from '../../../../../modules/recurring-order/plans';
import { PlanBody } from '../validators';
import { planChannelForSite } from '../../../../../modules/recurring-order/plan-site';
import { siteFromRequest } from '../../../../../lib/multistore';
import { assertRowInSite } from '../../../../../lib/multistore/scope';
import { SUBSCRIPTION_PLAN_SITE_SCOPE } from '../../../../../modules/recurring-order/site-scope';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const plan: any = await service.retrieveSubscriptionPlan(req.params.plan_id as string);
  assertRowInSite(plan, await siteFromRequest(req), SUBSCRIPTION_PLAN_SITE_SCOPE);
  res.status(200).json(await retrievePlanBundle(service, plan.id));
}

/** Drafts se reemplazan; un plan publicado genera una version nueva. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos invalidos.' });
    return;
  }
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const current: any = await service.retrieveSubscriptionPlan(req.params.plan_id as string);
  const resolution = await siteFromRequest(req);
  assertRowInSite(current, resolution, SUBSCRIPTION_PLAN_SITE_SCOPE);
  if (current.status === 'archived') throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Un plan archivado no se puede editar.');

  if (current.status === 'draft') {
    const oldOffers = await service.listSubscriptionPlanOffers({ plan_id: current.id });
    const oldTargets = await service.listSubscriptionTargets({ plan_id: current.id });
    if (oldOffers.length) await service.deleteSubscriptionPlanOffers(oldOffers.map((row: any) => row.id));
    if (oldTargets.length) await service.deleteSubscriptionTargets(oldTargets.map((row: any) => row.id));
    await service.updateSubscriptionPlans([{
      id: current.id,
      name: parsed.data.name,
      purchase_mode: parsed.data.purchase_mode,
      price_policy: parsed.data.price_policy,
      promotion_policy: parsed.data.promotion_policy,
      allow_stacking: parsed.data.allow_stacking,
      currency_code: parsed.data.currency_code?.toLowerCase() ?? null,
      preflight_hours: parsed.data.preflight_hours,
      reservation_hours: parsed.data.reservation_hours,
      stock_retry_hours: parsed.data.stock_retry_hours,
      stock_retry_interval_hours: parsed.data.stock_retry_interval_hours,
      payment_retry_hours: parsed.data.payment_retry_hours,
      payment_retry_interval_hours: parsed.data.payment_retry_interval_hours,
      forecast_windows: parsed.data.forecast_windows as unknown as Record<string, unknown>,
      trial_days: parsed.data.trial_days,
      minimum_cycles: parsed.data.minimum_cycles,
      metadata: parsed.data.metadata ?? null,
    }]);
    await service.createSubscriptionPlanOffers(parsed.data.offers.map((offer, index) => ({
      plan_id: current.id, ...offer, label: offer.label ?? null,
      currency_code: offer.currency_code?.toLowerCase() ?? parsed.data.currency_code?.toLowerCase() ?? null,
      fixed_unit_prices: offer.fixed_unit_prices ?? null, sort_order: offer.sort_order ?? index, enabled: true,
    })));
    await service.createSubscriptionTargets(parsed.data.targets.map((target) => ({
      plan_id: current.id, ...target,
      precedence: target.target_type === 'variant' ? 40 : target.target_type === 'product' ? 30 : target.target_type === 'category' ? 20 : 10,
      enabled: true,
    })));
    res.status(200).json(await retrievePlanBundle(service, current.id));
    return;
  }

  const next = await createPlanVersion(service, {
    ...parsed.data,
    sales_channel_id: planChannelForSite(
      resolution,
      parsed.data.sales_channel_id ?? current.sales_channel_id,
    ),
    handle: current.handle,
    currency_code: parsed.data.currency_code?.toLowerCase() ?? null,
  }, { version: Number(current.version) + 1 });
  res.status(201).json({ ...(await retrievePlanBundle(service, next.id)), versioned_from: current.id });
}

/** Archiva y devuelve el impacto; no cancela suscripciones existentes. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const id = req.params.plan_id as string;
  const plan: any = await service.retrieveSubscriptionPlan(id);
  assertRowInSite(plan, await siteFromRequest(req), SUBSCRIPTION_PLAN_SITE_SCOPE);
  const [, impacted] = await service.listAndCountRecurringOrders({ plan_id: id, status: ['active', 'paused', 'pending_payment', 'failed'] }, { take: 1 });
  await service.updateSubscriptionPlans([{ id, status: 'archived', archived_at: new Date() }]);
  res.status(200).json({ id, archived: true, impacted_subscriptions: impacted });
}
