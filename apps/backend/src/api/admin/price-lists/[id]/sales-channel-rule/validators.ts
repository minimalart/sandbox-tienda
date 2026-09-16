import { z } from 'zod';

/**
 * POST /admin/price-lists/:id/sales-channel-rule
 *
 * Assigns one or more sales channels to a price list via a native
 * `price_list_rule` row with attribute='sales_channel_id', operator='in'.
 *
 * Zod strip mode: every field is declared explicitly — no .passthrough().
 * Related ticket: EDUCABOT-9
 */
export const UpsertSalesChannelRuleSchema = z.object({
  sales_channel_ids: z
    .array(z.string().min(1))
    .min(1, 'At least one sales_channel_id is required'),
});

export type UpsertSalesChannelRuleInput = z.infer<typeof UpsertSalesChannelRuleSchema>;
