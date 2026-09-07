"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const rewards_1 = require("./rewards");
const now = Date.UTC(2026, 5, 1);
(0, node_test_1.test)('redeemable when active, in-window and in-stock', () => {
    strict_1.default.equal((0, rewards_1.rewardRedeemability)({ status: 'active', stock: 5 }, now).ok, true);
});
(0, node_test_1.test)('not redeemable: inactive / out of stock / expired', () => {
    strict_1.default.equal((0, rewards_1.rewardRedeemability)({ status: 'inactive' }, now).ok, false);
    strict_1.default.equal((0, rewards_1.rewardRedeemability)({ status: 'active', stock: 0 }, now).ok, false);
    strict_1.default.equal((0, rewards_1.rewardRedeemability)({ status: 'active', valid_to: '2026-01-01' }, now).ok, false);
});
(0, node_test_1.test)('null stock = unlimited', () => {
    strict_1.default.equal((0, rewards_1.rewardRedeemability)({ status: 'active', stock: null }, now).ok, true);
});
(0, node_test_1.test)('benefitTypeFor maps reward types', () => {
    strict_1.default.equal((0, rewards_1.benefitTypeFor)('percent_discount'), 'promotion');
    strict_1.default.equal((0, rewards_1.benefitTypeFor)('store_credit'), 'store_credit');
    strict_1.default.equal((0, rewards_1.benefitTypeFor)('custom'), 'none');
});
(0, node_test_1.test)('percent discount promotion payload', () => {
    const p = (0, rewards_1.buildPromotionInput)({ type: 'percent_discount', config: { value: 10 } }, 'LOY-X', 'ars', 'sc_1');
    strict_1.default.equal(p.code, 'LOY-X');
    strict_1.default.equal(p.is_automatic, false);
    strict_1.default.equal(p.application_method.type, 'percentage');
    strict_1.default.equal(p.application_method.value, 10);
    strict_1.default.deepEqual(p.rules[0].values, ['sc_1']);
});
(0, node_test_1.test)('fixed discount carries currency', () => {
    const p = (0, rewards_1.buildPromotionInput)({ type: 'fixed_discount', config: { value: 5000 } }, 'LOY-Y', 'ars');
    strict_1.default.equal(p.application_method.type, 'fixed');
    strict_1.default.equal(p.application_method.currency_code, 'ars');
});
(0, node_test_1.test)('free shipping targets shipping methods', () => {
    const p = (0, rewards_1.buildPromotionInput)({ type: 'free_shipping' }, 'LOY-Z', 'ars');
    strict_1.default.equal(p.application_method.target_type, 'shipping_methods');
    strict_1.default.equal(p.application_method.value, 100);
});
(0, node_test_1.test)('store_credit and custom have no coupon payload', () => {
    strict_1.default.equal((0, rewards_1.buildPromotionInput)({ type: 'store_credit' }, 'c', 'ars'), null);
    strict_1.default.equal((0, rewards_1.buildPromotionInput)({ type: 'custom' }, 'c', 'ars'), null);
});
(0, node_test_1.test)('free_product needs a product_id', () => {
    strict_1.default.equal((0, rewards_1.buildPromotionInput)({ type: 'free_product', config: {} }, 'c', 'ars'), null);
    const p = (0, rewards_1.buildPromotionInput)({ type: 'free_product', config: { product_id: 'prod_1' } }, 'c', 'ars');
    strict_1.default.equal(p.application_method.target_rules[0].values[0], 'prod_1');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV3YXJkcy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9saWIvcmV3YXJkcy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUNBQWlDO0FBQ2pDLGdFQUF3QztBQUN4Qyx1Q0FBcUY7QUFFckYsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRWpDLElBQUEsZ0JBQUksRUFBQyxnREFBZ0QsRUFBRSxHQUFHLEVBQUU7SUFDMUQsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBQSw2QkFBbUIsRUFBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNsRixDQUFDLENBQUMsQ0FBQztBQUVILElBQUEsZ0JBQUksRUFBQyxtREFBbUQsRUFBRSxHQUFHLEVBQUU7SUFDN0QsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBQSw2QkFBbUIsRUFBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekUsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBQSw2QkFBbUIsRUFBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNqRixnQkFBTSxDQUFDLEtBQUssQ0FBQyxJQUFBLDZCQUFtQixFQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2pHLENB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