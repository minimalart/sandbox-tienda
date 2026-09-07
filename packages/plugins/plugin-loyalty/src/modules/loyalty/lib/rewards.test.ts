import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewardRedeemability, benefitTypeFor, buildPromotionInput } from './rewards';

const now = Date.UTC(2026, 5, 1);

test('redeemable when active, in-window and in-stock', () => {
  assert.equal(rewardRedeemability({ status: 'active', stock: 5 }, now).ok, true);
});

test('not redeemable: inactive / out of stock / expired', () => {
  assert.equal(rewardRedeemability({ status: 'inactive' }, now).ok, false);
  assert.equal(rewardRedeemability({ status: 'active', stock: 0 }, now).ok, false);
  assert.equal(rewardRedeemability({ status: 'active', valid_to: '2026-01-01' }, now).ok, false);
});

test('null stock = unlimited', () => {
  assert.equal(rewardRedeemability({ status: 'active', stock: null }, now).ok, true);
});

test('benefitTypeFor maps reward types', () => {
  assert.equal(benefitTypeFor('percent_discount'), 'promotion');
  assert.equal(benefitTypeFor('store_credit'), 'store_credit');
  assert.equal(benefitTypeFor('custom'), 'none');
});

test('percent discount promotion payload', () => {
  const p = buildPromotionInput({ type: 'percent_discount', config: { value: 10 } }, 'LOY-X', 'ars', 'sc_1') as any;
  assert.equal(p.code, 'LOY-X');
  assert.equal(p.is_automatic, false);
  assert.equal(p.application_method.type, 'percentage');
  assert.equal(p.application_method.value, 10);
  assert.deepEqual(p.rules[0].values, ['sc_1']);
});

test('fixed discount carries currency', () => {
  const p = buildPromotionInput({ type: 'fixed_discount', config: { value: 5000 } }, 'LOY-Y', 'ars') as any;
  assert.equal(p.application_method.type, 'fixed');
  assert.equal(p.application_method.currency_code, 'ars');
});

test('free shipping targets shipping methods', () => {
  const p = buildPromotionInput({ type: 'free_shipping' }, 'LOY-Z', 'ars') as any;
  assert.equal(p.application_method.target_type, 'shipping_methods');
  assert.equal(p.application_method.value, 100);
});

test('store_credit and custom have no coupon payload', () => {
  assert.equal(buildPromotionInput({ type: 'store_credit' }, 'c', 'ars'), null);
  assert.equal(buildPromotionInput({ type: 'custom' }, 'c', 'ars'), null);
});

test('free_product needs a product_id', () => {
  assert.equal(buildPromotionInput({ type: 'free_product', config: {} }, 'c', 'ars'), null);
  const p = buildPromotionInput({ type: 'free_product', config: { product_id: 'prod_1' } }, 'c', 'ars') as any;
  assert.equal(p.application_method.target_rules[0].values[0], 'prod_1');
});
