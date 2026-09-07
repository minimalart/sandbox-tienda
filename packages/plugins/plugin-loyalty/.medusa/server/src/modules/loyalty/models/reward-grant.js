"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardGrant = void 0;
const utils_1 = require("@medusajs/framework/utils");
const reward_1 = require("./reward");
// The benefit a customer obtained by redeeming a reward. Distinct from the
// ledger movement: redeeming spends points (a `redeem` ledger entry) AND creates
// this grant, which references the produced Medusa benefit.
//
// Lifecycle: pending → available → used | expired | cancelled.
// `benefit_type` + `benefit_ref`: 'promotion' → coupon code; 'store_credit' → gift card id.
// `ledger_txn_id`: the points redeem transaction that paid for it.
// `customer_id` is the customer module's id kept as a scalar (no module link),
// matching the repo convention for per-customer data.
exports.RewardGrant = utils_1.model.define('loyalty_reward_grant', {
    id: utils_1.model.id({ prefix: 'loygr' }).primaryKey(),
    customer_id: utils_1.model.text(),
    status: utils_1.model.enum(['pending', 'available', 'used', 'expired', 'cancelled']).default('available'),
    benefit_type: utils_1.model.enum(['promotion', 'store_credit']).nullable(),
    benefit_ref: utils_1.model.text().nullable(),
    points_spent: utils_1.model.number().default(0),
    ledger_txn_id: utils_1.model.text().nullable(),
    expires_at: utils_1.model.dateTime().nullable(),
    used_at: utils_1.model.dateTime().nullable(),
    reward: utils_1.model.belongsTo(() => reward_1.Reward, { mappedBy: 'grants' }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV3YXJkLWdyYW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9tb2RlbHMvcmV3YXJkLWdyYW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCxxQ0FBa0M7QUFFbEMsMkVBQTJFO0FBQzNFLGlGQUFpRjtBQUNqRiw0REFBNEQ7QUFDNUQsRUFBRTtBQUNGLCtEQUErRDtBQUMvRCw0RkFBNEY7QUFDNUYsbUVBQW1FO0FBQ25FLCtFQUErRTtBQUMvRSxzREFBc0Q7QUFDekMsUUFBQSxXQUFXLEdBQUcsYUFBSyxDQUFDLE1BQU0sQ0FBQyxzQkFBc0IsRUFBRTtJQUM5RCxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM5QyxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN6QixNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7SUFDakcsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDbEUsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsWUFBWSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLFVBQVUsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3ZDLE9BQU8sRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLE1BQU0sRUFBRSxhQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLGVBQU0sRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQztDQUM5RCxDQUFDLENBQUMifQ==