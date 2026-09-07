"use strict";
// Pure reward helpers (redeemability + Medusa promotion payload), isolated for
// unit testing. The redeem workflow turns a Reward into a Promotion coupon or a
// Store Credit gift card; these helpers build the coupon payload and gate
// redeemability without touching the DB.
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewardRedeemability = rewardRedeemability;
exports.benefitTypeFor = benefitTypeFor;
exports.buildPromotionInput = buildPromotionInput;
function rewardRedeemability(reward, now) {
    if (reward.status && reward.status !== 'active')
        return { ok: false, reason: 'La recompensa no está activa' };
    if (reward.valid_from && now < Date.parse(reward.valid_from))
        return { ok: false, reason: 'La recompensa todavía no está vigente' };
    if (reward.valid_to && now > Date.parse(reward.valid_to))
        return { ok: false, reason: 'La recompensa venció' };
    if (reward.stock != null && reward.stock <= 0)
        return { ok: false, reason: 'Sin stock de la recompensa' };
    return { ok: true };
}
// Which Medusa mechanism produces the benefit for a reward type.
function benefitTypeFor(type) {
    if (type === 'store_credit')
        return 'store_credit';
    if (type === 'custom')
        return 'none';
    return 'promotion';
}
// Builds the `promotionsData` entry for createPromotionsWorkflow, or null when
// the reward type isn't coupon-backed. `is_automatic: false` → a code the
// customer applies at checkout.
function buildPromotionInput(reward, code, currencyCode, salesChannelId) {
    const value = Number(reward.config?.value) || 0;
    const rules = salesChannelId
        ? [{ attribute: 'sales_channel_id', operator: 'eq', values: [salesChannelId] }]
        : [];
    const base = { code, type: 'standard', status: 'active', is_automatic: false, rules };
    switch (reward.type) {
        case 'percent_discount':
            return {
                ...base,
                application_method: { type: 'percentage', target_type: 'order', allocation: 'across', value },
            };
        case 'fixed_discount':
            return {
                ...base,
                application_method: {
                    type: 'fixed',
                    target_type: 'order',
                    allocation: 'across',
                    value,
                    currency_code: currencyCode,
                },
            };
        case 'free_shipping':
            return {
                ...base,
                application_method: { type: 'percentage', target_type: 'shipping_methods', allocation: 'across', value: 100 },
            };
        case 'free_product': {
            const productId = reward.config?.product_id;
            if (!productId)
                return null;
            return {
                ...base,
                application_method: {
                    type: 'percentage',
                    target_type: 'items',
                    allocation: 'each',
                    value: 100,
                    max_quantity: 1,
                    target_rules: [{ attribute: 'items.product.id', operator: 'in', values: [productId] }],
                },
            };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV3YXJkcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xveWFsdHkvbGliL3Jld2FyZHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLCtFQUErRTtBQUMvRSxnRkFBZ0Y7QUFDaEYsMEVBQTBFO0FBQzFFLHlDQUF5Qzs7QUFvQnpDLGtEQVNDO0FBR0Qsd0NBSUM7QUFLRCxrREFvREM7QUF6RUQsU0FBZ0IsbUJBQW1CLENBQ2pDLE1BQWtCLEVBQ2xCLEdBQVc7SUFFWCxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxRQUFRO1FBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLDhCQUE4QixFQUFFLENBQUM7SUFDOUcsSUFBSSxNQUFNLENBQUMsVUFBVSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsdUNBQXVDLEVBQUUsQ0FBQztJQUNwSSxJQUFJLE1BQU0sQ0FBQyxRQUFRLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxzQkFBc0IsRUFBRSxDQUFDO0lBQy9HLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxJQUFJLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDO1FBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLDRCQUE0QixFQUFFLENBQUM7SUFDMUcsT0FBTyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQztBQUN0QixDQUFDO0FBRUQsaUVBQWlFO0FBQ2pFLFNBQWdCLGNBQWMsQ0FBQyxJQUFnQjtJQUM3QyxJ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