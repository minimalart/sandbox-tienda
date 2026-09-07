import { isSubscriptionFeatureEnabled } from '../../../modules/recurring-order/settings';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../modules/recurring-order/service';
import {
  channelsFromPublishableKey,
  siteFromPublishableKey,
} from '../../../lib/multistore/publishable-key';

type ProductFacts = {
  id: string;
  variantIds: Set<string>;
  categoryIds: Set<string>;
  tagValues: Set<string>;
};

const csv = (value: unknown): string[] =>
  String(value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 100);

/** Planes publicados aplicables a los productos/variantes consultados. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_V2_ENABLED') ||
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_STOREFRONT_ENABLED')
  ) {
    res.status(200).json({ plans: [], automatic_payments_enabled: false });
    return;
  }
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: unknown) => Promise<{ data: any[] }>;
  };
  const productIds = csv(req.query.product_ids);
  const variantIds = csv(req.query.variant_ids);
  await siteFromPublishableKey(req);
  const requestedChannelId = (req.query.sales_channel_id as string | undefined) ?? null;
  const allowedChannels = channelsFromPublishableKey(req);
  if (
    requestedChannelId &&
    allowedChannels.length &&
    !allowedChannels.includes(requestedChannelId)
  ) {
    res.status(200).json({ plans: [], automatic_payments_enabled: false });
    return;
  }
  const salesChannelIds = requestedChannelId ? [requestedChannelId] : allowedChannels;

  const facts = new Map<string, ProductFacts>();
  if (productIds.length) {
    const { data } = await query.graph({
      entity: 'product',
      fields: ['id', 'variants.id', 'categories.id', 'tags.value'],
      filters: { id: productIds },
    });
    for (const product of data)
      facts.set(product.id, {
        id: product.id,
        variantIds: new Set((product.variants ?? []).map((v: any) => v.id)),
        categoryIds: new Set((product.categories ?? []).map((c: any) => c.id)),
        tagValues: new Set((product.tags ?? []).map((t: any) => t.value)),
      });
  }
  if (variantIds.length) {
    const { data } = await query.graph({
      entity: 'variant',
      fields: ['id', 'product.id', 'product.categories.id', 'product.tags.value'],
      filters: { id: variantIds },
    });
    for (const variant of data) {
      if (!variant.product?.id) continue;
      const existing = facts.get(variant.product.id) ?? {
        id: variant.product.id,
        variantIds: new Set<string>(),
        categoryIds: new Set<string>(),
        tagValues: new Set<string>(),
      };
      existing.variantIds.add(variant.id);
      for (const category of variant.product.categories ?? [])
        existing.categoryIds.add(category.id);
      for (const tag of variant.product.tags ?? []) existing.tagValues.add(tag.value);
      facts.set(existing.id, existing);
    }
  }

  const channelFilter = salesChannelIds.length ? [...salesChannelIds, null] : [null];
  const plans: any[] = await service.listSubscriptionPlans(
    { sales_channel_id: channelFilter, status: 'active' },
    { order: { updated_at: 'DESC' } }
  );
  const result: any[] = [];
  for (const plan of plans) {
    if (plan.legacy || (plan.metadata as { hidden?: boolean } | null)?.hidden) continue;
    const targets: any[] = await service.listSubscriptionTargets({
      plan_id: plan.id,
      enabled: true,
    });
    const matches = [...facts.values()].filter((product) =>
      targets.some((target) => {
        if (target.target_type === 'variant') return product.variantIds.has(target.target_id);
        if (target.target_type === 'product') return product.id === target.target_id;
        if (target.target_type === 'category') return product.categoryIds.has(target.target_id);
        if (target.target_type === 'tag') return product.tagValues.has(target.target_id);
        return false;
      })
    );
    if (facts.size && !matches.length) continue;
    const offers = await service.listSubscriptionPlanOffers(
      { plan_id: plan.id, enabled: true },
      { order: { sort_order: 'ASC' } }
    );
    result.push({
      id: plan.id,
      name: plan.name,
      handle: plan.handle,
      version: plan.version,
      purchase_mode: plan.purchase_mode,
      price_policy: plan.price_policy,
      promotion_policy: plan.promotion_policy,
      allow_stacking: plan.allow_stacking,
      currency_code: plan.currency_code,
      trial_days: plan.trial_days,
      minimum_cycles: plan.minimum_cycles,
      offers,
      eligible_product_ids: matches.map((product) => product.id),
    });
  }
  res.status(200).json({
    plans: result,
    automatic_payments_enabled: isSubscriptionFeatureEnabled('SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED'),
  });
}
