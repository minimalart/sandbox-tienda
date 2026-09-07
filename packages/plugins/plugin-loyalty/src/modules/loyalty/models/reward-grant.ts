import { model } from '@medusajs/framework/utils';
import { Reward } from './reward';

// The benefit a customer obtained by redeeming a reward. Distinct from the
// ledger movement: redeeming spends points (a `redeem` ledger entry) AND creates
// this grant, which references the produced Medusa benefit.
//
// Lifecycle: pending → available → used | expired | cancelled.
// `benefit_type` + `benefit_ref`: 'promotion' → coupon code; 'store_credit' → gift card id.
// `ledger_txn_id`: the points redeem transaction that paid for it.
// `customer_id` is the customer module's id kept as a scalar (no module link),
// matching the repo convention for per-customer data.
export const RewardGrant = model.define('loyalty_reward_grant', {
  id: model.id({ prefix: 'loygr' }).primaryKey(),
  customer_id: model.text(),
  status: model.enum(['pending', 'available', 'used', 'expired', 'cancelled']).default('available'),
  benefit_type: model.enum(['promotion', 'store_credit']).nullable(),
  benefit_ref: model.text().nullable(),
  points_spent: model.number().default(0),
  ledger_txn_id: model.text().nullable(),
  expires_at: model.dateTime().nullable(),
  used_at: model.dateTime().nullable(),
  reward: model.belongsTo(() => Reward, { mappedBy: 'grants' }),
});
