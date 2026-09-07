"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EarnRule = void 0;
const utils_1 = require("@medusajs/framework/utils");
const loyalty_program_1 = require("./loyalty-program");
// How points are earned. Evaluated by the earn workflow when its `event` fires.
//
// `calc_type` / `calc_value`:
//   - fixed:      award exactly `calc_value` points.
//   - percentage: award `amount * calc_value / 100` points (amount = eligible total).
//   - multiplier: award `amount * calc_value` points.
// `conditions` (JSON): optional gates — { category_ids?, collection_ids?, brand_ids?,
//   min_amount?, customer_ids?, sales_channel_ids?, starts_at?, ends_at? }.
// `limits` (JSON): { per_customer?, per_day?, per_campaign? }.
exports.EarnRule = utils_1.model.define('loyalty_earn_rule', {
    id: utils_1.model.id({ prefix: 'loyer' }).primaryKey(),
    name: utils_1.model.text(),
    status: utils_1.model.enum(['active', 'inactive']).default('active'),
    priority: utils_1.model.number().default(0),
    event: utils_1.model.enum([
        'purchase',
        'signup',
        'first_purchase',
        'order_delivered',
        'birthday',
        'referral',
        'comment',
    ]),
    calc_type: utils_1.model.enum(['fixed', 'percentage', 'multiplier']),
    calc_value: utils_1.model.number().default(0),
    conditions: utils_1.model.json().nullable(),
    limits: utils_1.model.json().nullable(),
    program: utils_1.model.belongsTo(() => loyalty_program_1.LoyaltyProgram, { mappedBy: 'earn_rules' }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWFybi1ydWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9tb2RlbHMvZWFybi1ydWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCx1REFBbUQ7QUFFbkQsZ0ZBQWdGO0FBQ2hGLEVBQUU7QUFDRiw4QkFBOEI7QUFDOUIscURBQXFEO0FBQ3JELHNGQUFzRjtBQUN0RixzREFBc0Q7QUFDdEQsc0ZBQXNGO0FBQ3RGLDRFQUE0RTtBQUM1RSwrREFBK0Q7QUFDbEQsUUFBQSxRQUFRLEdBQUcsYUFBSyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsRUFBRTtJQUN4RCxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM5QyxJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFDNUQsUUFBUSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ25DLEtBQUssRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDO1FBQ2hCLFVBQVU7UUFDVixRQUFRO1FBQ1IsZ0JBQWdCO1FBQ2hCLGlCQUFpQjtRQUNqQixVQUFVO1FBQ1YsVUFBVTtRQUNWLFNBQVM7S0FDVixDQUFDO0lBQ0YsU0FBUyxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzVELFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuQyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMvQixPQUFPLEVBQUUsYUFBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxnQ0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxDQUFDO0NBQzNFLENBQUMsQ0FBQyJ9