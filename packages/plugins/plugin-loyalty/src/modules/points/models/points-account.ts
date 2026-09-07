import { model } from '@medusajs/framework/utils';
import { PointsTransaction } from './points-transaction';

// One loyalty account per customer. `balance` is a denormalized cache of the
// AVAILABLE points (Σ of ledger entries with status='available', floored at 0),
// recomputed from the ledger on every write for fast reads. The ledger is the
// source of truth — see modules/points/service.ts.
export const PointsAccount = model.define('points_account', {
  id: model
    .id({
      prefix: 'ptacc',
    })
    .primaryKey(),
  customer_id: model.text().unique(),
  balance: model.number().default(0),
  transactions: model.hasMany(() => PointsTransaction, {
    mappedBy: 'account',
  }),
});
