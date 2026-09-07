import { model } from '@medusajs/framework/utils';
import { LoyaltyProgram } from './loyalty-program';

// How points are earned. Evaluated by the earn workflow when its `event` fires.
//
// `calc_type` / `calc_value`:
//   - fixed:      award exactly `calc_value` points.
//   - percentage: award `amount * calc_value / 100` points (amount = eligible total).
//   - multiplier: award `amount * calc_value` points.
// `conditions` (JSON): optional gates — { category_ids?, collection_ids?, brand_ids?,
//   min_amount?, customer_ids?, sales_channel_ids?, starts_at?, ends_at? }.
// `limits` (JSON): { per_customer?, per_day?, per_campaign? }.
export const EarnRule = model.define('loyalty_earn_rule', {
  id: model.id({ prefix: 'loyer' }).primaryKey(),
  name: model.text(),
  status: model.enum(['active', 'inactive']).default('active'),
  priority: model.number().default(0),
  event: model.enum([
    'purchase',
    'signup',
    'first_purchase',
    'order_delivered',
    'birthday',
    'referral',
    'comment',
  ]),
  calc_type: model.enum(['fixed', 'percentage', 'multiplier']),
  calc_value: model.number().default(0),
  conditions: model.json().nullable(),
  limits: model.json().nullable(),
  program: model.belongsTo(() => LoyaltyProgram, { mappedBy: 'earn_rules' }),
});
