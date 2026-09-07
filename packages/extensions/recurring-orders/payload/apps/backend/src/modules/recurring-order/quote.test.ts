import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quoteSubscription } from './quote.ts';
import type { SubscriptionPlanSnapshot } from './types.ts';

const snapshot = (overrides: Partial<SubscriptionPlanSnapshot> = {}): SubscriptionPlanSnapshot => ({
  id: 'splan_1', name: 'Reposicion', handle: 'reposicion', version: 1,
  purchase_mode: 'one_time_and_subscription', price_policy: 'dynamic',
  promotion_policy: 'best_benefit', allow_stacking: false, currency_code: 'ars',
  preflight_hours: 72, reservation_hours: 24, stock_retry_hours: 72,
  stock_retry_interval_hours: 6, trial_days: 0, minimum_cycles: 0,
  cancellation_policy: 'immediate',
  offer: {
    id: 'spoff_1', label: null, frequency_interval: 'month', frequency_count: 1,
    discount_type: 'percentage', discount_value: 20, currency_code: 'ars',
    fixed_unit_prices: null,
  },
  ...overrides,
});

describe('quoteSubscription', () => {
  it('aplica solo la diferencia cuando la promo existente es menor', () => {
    const quote = quoteSubscription([
      { item_id: 'i1', product_id: 'p1', variant_id: 'v1', quantity: 2, unit_price: 1000, existing_discount: 200 },
    ], snapshot(), 'ars');
    assert.equal(quote.plan_benefit, 400);
    assert.equal(quote.applied_plan_adjustment, 200);
    assert.equal(quote.total, 1600);
  });

  it('no agrega descuento cuando la promocion existente es mejor', () => {
    const quote = quoteSubscription([
      { item_id: 'i1', product_id: 'p1', variant_id: 'v1', quantity: 1, unit_price: 1000, existing_discount: 300 },
    ], snapshot(), 'ars');
    assert.equal(quote.applied_plan_adjustment, 0);
    assert.equal(quote.total, 700);
  });

  it('soporta precio fijo por variante', () => {
    const quote = quoteSubscription([
      { item_id: 'i1', product_id: 'p1', variant_id: 'v1', quantity: 2, unit_price: 1000 },
    ], snapshot({
      price_policy: 'fixed',
      offer: { ...snapshot().offer, discount_type: 'none', discount_value: 0, fixed_unit_prices: { v1: 750 } },
    }), 'ars');
    assert.equal(quote.total, 1500);
    assert.equal(quote.plan_benefit, 500);
  });

  it('acumula promoción y beneficio sólo cuando stacking está habilitado', () => {
    const quote = quoteSubscription([
      { item_id: 'i1', product_id: 'p1', variant_id: 'v1', quantity: 1, unit_price: 1000, existing_discount: 100 },
    ], snapshot({ allow_stacking: true }), 'ars');
    assert.equal(quote.existing_discount, 100);
    assert.equal(quote.applied_plan_adjustment, 200);
    assert.equal(quote.total, 700);
  });

  it('limita un beneficio fijo al subtotal de cada línea', () => {
    const quote = quoteSubscription([
      { item_id: 'i1', product_id: 'p1', variant_id: 'v1', quantity: 2, unit_price: 400 },
    ], snapshot({
      offer: { ...snapshot().offer, discount_type: 'fixed_amount', discount_value: 1000 },
    }), 'ars');
    assert.equal(quote.plan_benefit, 800);
    assert.equal(quote.total, 0);
  });

  it('produce un hash estable y sensible al contrato cotizado', () => {
    const lines = [
      { item_id: 'i1', product_id: 'p1', variant_id: 'v1', quantity: 1, unit_price: 1000 },
    ];
    const first = quoteSubscription(lines, snapshot(), 'ars');
    const repeated = quoteSubscription(lines, snapshot(), 'ars');
    const changed = quoteSubscription(lines, snapshot({
      offer: { ...snapshot().offer, discount_value: 15 },
    }), 'ars');
    assert.equal(first.hash, repeated.hash);
    assert.notEqual(first.hash, changed.hash);
  });
});
