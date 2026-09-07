import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore';
import { RECURRING_ORDER_MODULE } from '../../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../../modules/recurring-order/service';
import { createPlanVersion, retrievePlanBundle } from '../../../../../../modules/recurring-order/plans';
import { assertRowInSite } from '../../../../../../lib/multistore/scope';
import { SUBSCRIPTION_PLAN_SITE_SCOPE } from '../../../../../../modules/recurring-order/site-scope';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const id = req.params.plan_id as string;
  const { plan, offers, targets } = await retrievePlanBundle(service, id);
  assertRowInSite(plan, await siteFromRequest(req), SUBSCRIPTION_PLAN_SITE_SCOPE);
  const duplicate = await createPlanVersion(service, {
    sales_channel_id: plan.sales_channel_id ?? null,
    name: `${plan.name} (copia)`,
    purchase_mode: plan.purchase_mode,
    price_policy: plan.price_policy,
    promotion_policy: plan.promotion_policy,
    allow_stacking: Boolean(plan.allow_stacking),
    currency_code: plan.currency_code ?? null,
    preflight_hours: Number(plan.preflight_hours ?? 72),
    reservation_hours: Number(plan.reservation_hours ?? 24),
    stock_retry_hours: Number(plan.stock_retry_hours ?? 72),
    stock_retry_interval_hours: Number(plan.stock_retry_interval_hours ?? 6),
    forecast_windows: (plan.forecast_windows as unknown as number[]) ?? [14, 30],
    trial_days: Number(plan.trial_days ?? 0),
    minimum_cycles: Number(plan.minimum_cycles ?? 0),
    offers: offers.map((offer: any) => ({
      label: offer.label ?? null,
      frequency_interval: offer.frequency_interval,
      frequency_count: Number(offer.frequency_count),
      discount_type: offer.discount_type,
      discount_value: Number(offer.discount_value),
      currency_code: offer.currency_code ?? null,
      fixed_unit_prices: offer.fixed_unit_prices ?? null,
      sort_order: Number(offer.sort_order ?? 0),
    })),
    targets: targets.map((target: any) => ({
      target_type: target.target_type,
      target_id: target.target_id,
    })),
    metadata: { ...(plan.metadata ?? {}), duplicated_from: plan.id },
  });
  res.status(201).json(await retrievePlanBundle(service, duplicate.id));
}
