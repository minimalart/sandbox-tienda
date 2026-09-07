import { z } from 'zod';

const statusEnum = z.enum(['active', 'inactive']);

export const CreateProgramSchema = z.object({
  name: z.string().min(1),
  status: statusEnum.optional(),
  points_name: z.string().optional(),
  currency_code: z.string().optional(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  expiration_policy: z.record(z.string(), z.any()).nullish(),
  config: z.record(z.string(), z.any()).nullish(),
});
export const UpdateProgramSchema = CreateProgramSchema.partial();

export const CreateRuleSchema = z.object({
  program_id: z.string().min(1),
  name: z.string().min(1),
  status: statusEnum.optional(),
  priority: z.number().int().optional(),
  event: z.enum(['purchase', 'signup', 'first_purchase', 'order_delivered', 'birthday', 'referral', 'comment']),
  calc_type: z.enum(['fixed', 'percentage', 'multiplier']),
  calc_value: z.number().int().nonnegative(),
  conditions: z.record(z.string(), z.any()).nullish(),
  limits: z.record(z.string(), z.any()).nullish(),
});
export const UpdateRuleSchema = CreateRuleSchema.partial();

export const CreateRewardSchema = z.object({
  program_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
  image_url: z.string().nullish(),
  cost_points: z.number().int().nonnegative(),
  type: z.enum(['fixed_discount', 'percent_discount', 'free_shipping', 'free_product', 'store_credit', 'custom']),
  config: z.record(z.string(), z.any()).nullish(),
  stock: z.number().int().nullish(),
  valid_from: z.string().nullish(),
  valid_to: z.string().nullish(),
  segments: z.record(z.string(), z.any()).nullish(),
  status: statusEnum.optional(),
});
export const UpdateRewardSchema = CreateRewardSchema.partial();

export const CreateTierSchema = z.object({
  program_id: z.string().min(1),
  name: z.string().min(1),
  condition_type: z.enum(['spend', 'points', 'orders']).optional(),
  threshold: z.number().int().nonnegative().optional(),
  multiplier: z.number().int().optional(),
  benefits: z.record(z.string(), z.any()).nullish(),
});
export const UpdateTierSchema = CreateTierSchema.partial();

export const CreateCampaignSchema = z.object({
  program_id: z.string().min(1),
  name: z.string().min(1),
  status: statusEnum.optional(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  multiplier: z.number().int().optional(),
  affected_rule_ids: z.array(z.string()).nullish(),
  limits: z.record(z.string(), z.any()).nullish(),
  priority: z.number().int().optional(),
});
export const UpdateCampaignSchema = CreateCampaignSchema.partial();
