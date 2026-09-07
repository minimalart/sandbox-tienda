"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsTransaction = void 0;
const utils_1 = require("@medusajs/framework/utils");
const points_account_1 = require("./points-account");
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
exports.PointsTransaction = utils_1.model.define('points_transaction', {
    id: utils_1.model
        .id({
        prefix: 'pttxn',
    })
        .primaryKey(),
    amount: utils_1.model.number(),
    type: utils_1.model.enum(['earn', 'redeem', 'adjust', 'reverse', 'expire']),
    status: utils_1.model.enum(['pending', 'available', 'expired', 'reversed']).default('available'),
    reference: utils_1.model.text().nullable(),
    reference_id: utils_1.model.text().nullable(),
    idempotency_key: utils_1.model.text().nullable(),
    expires_at: utils_1.model.dateTime().nullable(),
    program_id: utils_1.model.text().nullable(),
    earn_rule_id: utils_1.model.text().nullable(),
    campaign_id: utils_1.model.text().nullable(),
    account: utils_1.model.belongsTo(() => points_account_1.PointsAccount, {
        mappedBy: 'transactions',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9pbnRzLXRyYW5zYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvcG9pbnRzL21vZGVscy9wb2ludHMtdHJhbnNhY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBQ2xELHFEQUFpRDtBQUVqRCw4RUFBOEU7QUFDOUUsb0VBQW9FO0FBQ3BFLEVBQUU7QUFDRiw4REFBOEQ7QUFDOUQsa0VBQWtFO0FBQ2xFLHNFQUFzRTtBQUN0RSxvRUFBb0U7QUFDcEUsbUVBQW1FO0FBQ25FLHlFQUF5RTtBQUN6RSxnRkFBZ0Y7QUFDaEYsK0VBQStFO0FBQy9FLG9CQUFvQjtBQUNwQixFQUFFO0FBQ0YsNkVBQTZFO0FBQzdFLDhFQUE4RTtBQUM5RSxnRkFBZ0Y7QUFDaEYsdUVBQXVFO0FBQ3ZFLDJEQUEyRDtBQUM5QyxRQUFBLGlCQUFpQixHQUFHLGFBQUssQ0FBQyxNQUFNLENBQUMsb0JBQW9CLEVBQUU7SUFDbEUsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsT0FBTztLQUNoQixDQUFDO1NBQ0QsVUFBVSxFQUFFO0lBQ2YsTUFBTSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUU7SUFDdEIsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDbkUsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7SUFDeEYsU0FBUyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDckMsZUFBZSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDeEMsVUFBVSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdkMsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbkMsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDckMsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsT0FBTyxFQUFFLGFBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsOEJBQWEsRUFBRTtRQUM1QyxRQUFRLEVBQUUsY0FBYztLQUN6QixDQUFDO0NBQ0gsQ0FBQyxDQUFDIn0=