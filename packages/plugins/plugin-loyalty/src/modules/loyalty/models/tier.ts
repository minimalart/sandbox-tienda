import { model } from '@medusajs/framework/utils';
import { LoyaltyProgram } from './loyalty-program';

// A VIP level. A customer's tier is derived from accumulated spend / points /
// orders (>= threshold). `multiplier` boosts earn rules; `benefits` (JSON) holds
// extra perks and can reference tier-exclusive rewards.
export const Tier = model.define('loyalty_tier', {
  id: model.id({ prefix: 'loyti' }).primaryKey(),
  name: model.text(),
  condition_type: model.enum(['spend', 'points', 'orders']).default('spend'),
  threshold: model.number().default(0),
  multiplier: model.number().default(1),
  benefits: model.json().nullable(),
  program: model.belongsTo(() => LoyaltyProgram, { mappedBy: 'tiers' }),
});
