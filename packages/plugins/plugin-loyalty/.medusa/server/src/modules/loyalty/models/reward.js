"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reward = void 0;
const utils_1 = require("@medusajs/framework/utils");
const loyalty_program_1 = require("./loyalty-program");
const reward_grant_1 = require("./reward-grant");
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
exports.Reward = utils_1.model.define('loyalty_reward', {
    id: utils_1.model.id({ prefix: 'loyrw' }).primaryKey(),
    name: utils_1.model.text(),
    description: utils_1.model.text().nullable(),
    image_url: utils_1.model.text().nullable(),
    cost_points: utils_1.model.number(),
    type: utils_1.model.enum([
        'fixed_discount',
        'percent_discount',
        'free_shipping',
        'free_product',
        'store_credit',
        'custom',
    ]),
    config: utils_1.model.json().nullable(),
    stock: utils_1.model.number().nullable(),
    valid_from: utils_1.model.dateTime().nullable(),
    valid_to: utils_1.model.dateTime().nullable(),
    segments: utils_1.model.json().nullable(),
    status: utils_1.model.enum(['active', 'inactive']).default('active'),
    program: utils_1.model.belongsTo(() => loyalty_program_1.LoyaltyProgram, { mappedBy: 'rewards' }),
    grants: utils_1.model.hasMany(() => reward_grant_1.RewardGrant, { mappedBy: 'reward' }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV3YXJkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9tb2RlbHMvcmV3YXJkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCx1REFBbUQ7QUFDbkQsaURBQTZDO0FBRTdDLDRFQUE0RTtBQUM1RSwwRUFBMEU7QUFDMUUsa0ZBQWtGO0FBQ2xGLEVBQUU7QUFDRixzREFBc0Q7QUFDdEQsMkZBQTJGO0FBQzNGLCtEQUErRDtBQUMvRCwyREFBMkQ7QUFDM0QseUZBQXlGO0FBQ3pGLCtFQUErRTtBQUNsRSxRQUFBLE1BQU0sR0FBRyxhQUFLLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFO0lBQ25ELEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzlDLElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ2xCLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLFdBQVcsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFO0lBQzNCLElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDO1FBQ2YsZ0JBQWdCO1FBQ2hCLGtCQUFrQjtRQUNsQixlQUFlO1FBQ2YsY0FBYztRQUNkLGNBQWM7UUFDZCxRQUFRO0tBQ1QsQ0FBQztJQUNGLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQy9CLEtBQUssRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hDLFVBQVUsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3ZDLFFBQVEsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3JDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pDLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUM1RCxPQUFPLEVBQUUsYUFBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxnQ0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxDQUFDO0lBQ3ZFLE1BQU0sRUFBRSxhQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLDBCQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLENBQUM7Q0FDakUsQ0FBQyxDQUFDIn0=