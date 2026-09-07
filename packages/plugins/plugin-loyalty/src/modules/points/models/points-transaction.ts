import { model } from '@medusajs/framework/utils';
import { PointsAccount } from './points-account';

// Append-only ledger entry. `amount` is signed: positive for earns / positive
// adjustments, negative for redemptions, reversals and expirations.
//
// `status` marks how the entry affects the available balance:
//   - available: posted; counts toward the balance (the default).
//   - pending:   earned but not yet usable (matures later); excluded.
//   - expired:   an earn lot that expired before posting; excluded.
//   - reversed:  an earn lot clawed back before posting; excluded.
// Available balance = Σ amount over entries with status='available' (see
// modules/points/lib/ledger.ts). Reversals/expirations of already-posted points
// are recorded as their own negative `reverse`/`expire` entries so the history
// is never mutated.
//
// `idempotency_key` is unique (partial index, see the migration) so the same
// source event never credits or debits twice. `reference`/`reference_id` link
// back to the source (e.g. an order). `program_id`/`earn_rule_id`/`campaign_id`
// attribute the movement to the Loyalty Engine entity that produced it
// (nullable — legacy rows and manual movements have none).
export const PointsTransaction = model.define('points_transaction', {
  id: model
    .id({
      prefix: 'pttxn',
    })
    .primaryKey(),
  amount: model.number(),
  type: model.enum(['earn', 'redeem', 'adjust', 'reverse', 'expire']),
  status: model.enum(['pending', 'available', 'expired', 'reversed']).default('available'),
  reference: model.text().nullable(),
  reference_id: model.text().nullable(),
  idempotency_key: model.text().nullable(),
  expires_at: model.dateTime().nullable(),
  program_id: model.text().nullable(),
  earn_rule_id: model.text().nullable(),
  campaign_id: model.text().nullable(),
  account: model.belongsTo(() => PointsAccount, {
    mappedBy: 'transactions',
  }),
});
