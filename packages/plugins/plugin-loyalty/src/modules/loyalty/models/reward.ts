import { model } from '@medusajs/framework/utils';
import { LoyaltyProgram } from './loyalty-program';
import { RewardGrant } from './reward-grant';

// Something a customer can redeem points for. Redemption (the transactional
// workflow) turns a Reward into a RewardGrant + the actual Medusa benefit
// (a Promotion coupon or a Store Credit gift card) — this row is only the config.
//
// `type` → how the benefit is produced at redemption:
//   - fixed_discount / percent_discount / free_shipping / free_product → Promotion coupon.
//   - store_credit → gift card backing a store-credit account.
//   - custom → no automatic benefit (future integrations).
// `config` (JSON): type-specific — { value?, currency_code?, product_id?, variant_id? }.
// `segments` (JSON): optional allow-list — { customer_group_ids?, tier_ids? }.
export const Reward = model.define('loyalty_reward', {
  id: model.id({ prefix: 'loyrw' }).primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
  image_url: model.text().nullable(),
  cost_points: model.number(),
  type: model.enum([
    'fixed_discount',
    'percent_discount',
    'free_shipping',
    'free_product',
    'store_credit',
    'custom',
  ]),
  config: model.json().nullable(),
  stock: model.number().nullable(),
  valid_from: model.dateTime().nullable(),
  valid_to: model.dateTime().nullable(),
  segments: model.json().nullable(),
  status: model.enum(['active', 'inactive']).default('active'),
  program: model.belongsTo(() => LoyaltyProgram, { mappedBy: 'rewards' }),
  grants: model.hasMany(() => RewardGrant, { mappedBy: 'reward' }),
});
