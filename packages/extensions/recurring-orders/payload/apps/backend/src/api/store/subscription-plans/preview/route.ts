import { isSubscriptionFeatureEnabled } from '../../../../modules/recurring-order/settings';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, QueryContext } from '@medusajs/framework/utils';
import { z } from 'zod';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';
import { snapshotPlan } from '../../../../modules/recurring-order/plans';
import { quoteSubscription } from '../../../../modules/recurring-order/quote';
import { addInterval } from '../../../../modules/recurring-order/lib';
import { productMatchesPlan } from '../../../../modules/recurring-order/plans';
import {
  channelsFromPublishableKey,
  siteFromPublishableKey,
} from '../../../../lib/multistore/publishable-key';

const Body = z.object({
  plan_id: z.string().min(1),
  offer_id: z.string().min(1),
  region_id: z.string().nullish(),
  currency_code: z.string().length(3).default('ars'),
  items: z
    .array(z.object({ variant_id: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1)
    .max(100),
});

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_V2_ENABLED') ||
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_STOREFRONT_ENABLED')
  ) {
    res.status(404).json({ message: 'Los planes de suscripción no están habilitados.' });
    return;
  }
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos invalidos.' });
    return;
  }
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  await siteFromPublishableKey(req);
  const allowedChannels = channelsFromPublishableKey(req);
  const plan: any = await service.retrieveSubscriptionPlan(parsed.data.plan_id);
  if (
    plan.status !== 'active' ||
    plan.legacy ||
    (plan.metadata as { hidden?: boolean } | null)?.hidden ||
    (plan.sales_channel_id &&
      allowedChannels.length &&
      !allowedChannels.includes(plan.sales_channel_id))
  ) {
    res.status(404).json({ message: 'El plan no está disponible en esta tienda.' });
    return;
  }
  const snapshot = await snapshotPlan(service, parsed.data.plan_id, parsed.data.offer_id);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: unknown) => Promise<{ data: any[] }>;
  };
  const { data: variants } = await query.graph({
    entity: 'variant',
    fields: [
      'id',
      'product.id',
      'product.status',
      'product.sales_channels.id',
      'product.categories.id',
      'product.tags.value',
      'calculated_price.calculated_amount',
      'calculated_price.currency_code',
    ],
    filters: { id: parsed.data.items.map((item) => item.variant_id) },
    context: {
      calculated_price: QueryContext({
        ...(parsed.data.region_id ? { region_id: parsed.data.region_id } : {}),
        currency_code: parsed.data.currency_code.toLowerCase(),
      }),
    },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  for (const requested of parsed.data.items) {
    const variant: any = byId.get(requested.variant_id);
    const product = variant?.product;
    const inAllowedChannel =
      !allowedChannels.length ||
      (product?.sales_channels ?? []).some((channel: any) => allowedChannels.includes(channel.id));
    const eligible =
      product?.id &&
      (await productMatchesPlan(service, plan.id, {
        id: product.id,
        variant_id: variant.id,
        category_ids: (product.categories ?? []).map((category: any) => category.id),
        tag_values: (product.tags ?? []).map((tag: any) => tag.value),
      }));
    if (!product?.id || product.status !== 'published' || !inAllowedChannel || !eligible) {
      res.status(400).json({ message: 'Uno de los productos no está disponible para este plan.' });
      return;
    }
  }
  const lines = parsed.data.items.map((item, index) => {
    const variant = byId.get(item.variant_id);
    return {
      item_id: `preview_${index}`,
      product_id: variant?.product?.id ?? '',
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: Number(variant?.calculated_price?.calculated_amount ?? 0),
      existing_discount: 0,
    };
  });
  const quote = quoteSubscription(lines, snapshot, parsed.data.currency_code);
  const next = addInterval(
    new Date(),
    snapshot.offer.frequency_interval,
    snapshot.offer.frequency_count
  );
  res
    .status(200)
    .json({
      quote,
      next_execution_at: next.toISOString(),
      shipping_excluded: true,
      plan: snapshot,
    });
}
