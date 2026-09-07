// Pure reward helpers (redeemability + Medusa promotion payload), isolated for
// unit testing. The redeem workflow turns a Reward into a Promotion coupon or a
// Store Credit gift card; these helpers build the coupon payload and gate
// redeemability without touching the DB.

export type RewardType =
  | 'fixed_discount'
  | 'percent_discount'
  | 'free_shipping'
  | 'free_product'
  | 'store_credit'
  | 'custom';

export type RewardLike = {
  status?: string;
  stock?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  cost_points?: number;
  type?: RewardType;
  config?: { value?: number; currency_code?: string; product_id?: string } | null;
};

export function rewardRedeemability(
  reward: RewardLike,
  now: number,
): { ok: boolean; reason?: string } {
  if (reward.status && reward.status !== 'active') return { ok: false, reason: 'La recompensa no está activa' };
  if (reward.valid_from && now < Date.parse(reward.valid_from)) return { ok: false, reason: 'La recompensa todavía no está vigente' };
  if (reward.valid_to && now > Date.parse(reward.valid_to)) return { ok: false, reason: 'La recompensa venció' };
  if (reward.stock != null && reward.stock <= 0) return { ok: false, reason: 'Sin stock de la recompensa' };
  return { ok: true };
}

// Which Medusa mechanism produces the benefit for a reward type.
export function benefitTypeFor(type: RewardType): 'promotion' | 'store_credit' | 'none' {
  if (type === 'store_credit') return 'store_credit';
  if (type === 'custom') return 'none';
  return 'promotion';
}

// Builds the `promotionsData` entry for createPromotionsWorkflow, or null when
// the reward type isn't coupon-backed. `is_automatic: false` → a code the
// customer applies at checkout.
export function buildPromotionInput(
  reward: RewardLike,
  code: string,
  currencyCode: string,
  salesChannelId?: string | null,
): Record<string, unknown> | null {
  const value = Number(reward.config?.value) || 0;
  const rules = salesChannelId
    ? [{ attribute: 'sales_channel_id', operator: 'eq', values: [salesChannelId] }]
    : [];
  const base = { code, type: 'standard', status: 'active', is_automatic: false, rules };

  switch (reward.type) {
    case 'percent_discount':
      return {
        ...base,
        application_method: { type: 'percentage', target_type: 'order', allocation: 'across', value },
      };
    case 'fixed_discount':
      return {
        ...base,
        application_method: {
          type: 'fixed',
          target_type: 'order',
          allocation: 'across',
          value,
          currency_code: currencyCode,
        },
      };
    case 'free_shipping':
      return {
        ...base,
        application_method: { type: 'percentage', target_type: 'shipping_methods', allocation: 'across', value: 100 },
      };
    case 'free_product': {
      const productId = reward.config?.product_id;
      if (!productId) return null;
      return {
        ...base,
        application_method: {
          type: 'percentage',
          target_type: 'items',
          allocation: 'each',
          value: 100,
          max_quantity: 1,
          target_rules: [{ attribute: 'items.product.id', operator: 'in', values: [productId] }],
        },
      };
    }
    default:
      return null;
  }
}
