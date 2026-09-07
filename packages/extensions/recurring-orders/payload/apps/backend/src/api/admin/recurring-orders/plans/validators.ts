import { z } from 'zod';

const Offer = z.object({
  label: z.string().max(120).nullish(),
  frequency_interval: z.enum(['day', 'week', 'month']),
  frequency_count: z.number().int().min(1).max(365),
  discount_type: z.enum(['none', 'percentage', 'fixed_amount', 'fixed_price']),
  discount_value: z.number().min(0).default(0),
  currency_code: z.string().length(3).nullish(),
  fixed_unit_prices: z.record(z.string(), z.number().min(0)).nullish(),
  sort_order: z.number().int().min(0).optional(),
});

const Target = z.object({
  target_type: z.enum(['variant', 'product', 'category', 'tag']),
  target_id: z.string().min(1),
});

export const PlanBody = z.object({
  sales_channel_id: z.string().min(1).nullish(),
  name: z.string().min(1).max(160),
  handle: z.string().max(80).optional(),
  purchase_mode: z.enum(['one_time_and_subscription', 'subscription_only']).default('one_time_and_subscription'),
  price_policy: z.enum(['dynamic', 'fixed']).default('dynamic'),
  promotion_policy: z.enum(['best_benefit', 'subscription_only', 'stack']).default('best_benefit'),
  allow_stacking: z.boolean().default(false),
  currency_code: z.string().length(3).nullish(),
  preflight_hours: z.number().int().min(1).max(720).default(72),
  reservation_hours: z.number().int().min(1).max(168).default(24),
  stock_retry_hours: z.number().int().min(1).max(720).default(72),
  stock_retry_interval_hours: z.number().int().min(1).max(72).default(6),
  payment_retry_hours: z.number().int().min(1).max(720).default(72),
  payment_retry_interval_hours: z.number().int().min(1).max(72).default(6),
  forecast_windows: z.array(z.number().int().min(1).max(365)).min(1).max(4).default([14, 30]),
  trial_days: z.number().int().min(0).max(365).default(0),
  minimum_cycles: z.number().int().min(0).max(120).default(0),
  offers: z.array(Offer).min(1).max(24),
  targets: z.array(Target).min(1).max(2000),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type PlanBodyType = z.infer<typeof PlanBody>;
