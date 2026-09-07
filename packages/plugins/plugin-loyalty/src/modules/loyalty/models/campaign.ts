import { model } from '@medusajs/framework/utils';
import { LoyaltyProgram } from './loyalty-program';

// A time-boxed boost (double/triple points, extra points). While active, the
// earn workflow applies `multiplier` to the rules listed in `affected_rule_ids`
// (empty = all rules). `priority` breaks ties when several campaigns overlap.
export const Campaign = model.define('loyalty_campaign', {
  id: model.id({ prefix: 'loycm' }).primaryKey(),
  name: model.text(),
  status: model.enum(['active', 'inactive']).default('active'),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  multiplier: model.number().default(1),
  affected_rule_ids: model.json().nullable(),
  limits: model.json().nullable(),
  priority: model.number().default(0),
  program: model.belongsTo(() => LoyaltyProgram, { mappedBy: 'campaigns' }),
});
