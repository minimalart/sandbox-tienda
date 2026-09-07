import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCustomerTier, tierMultiplier, tierProgress } from './tiers';

const tiers = [
  { id: 'bronze', condition_type: 'points' as const, threshold: 0, multiplier: 1 },
  { id: 'silver', condition_type: 'points' as const, threshold: 1000, multiplier: 2 },
  { id: 'gold', condition_type: 'points' as const, threshold: 5000, multiplier: 3 },
];

test('picks the highest tier whose threshold is met', () => {
  assert.equal(computeCustomerTier(tiers, { points: 1500, spend: 0, orders: 0 })?.id, 'silver');
  assert.equal(computeCustomerTier(tiers, { points: 9000, spend: 0, orders: 0 })?.id, 'gold');
  assert.equal(computeCustomerTier(tiers, { points: 0, spend: 0, orders: 0 })?.id, 'bronze');
});

test('tierMultiplier defaults to 1 for null', () => {
  assert.equal(tierMultiplier(null), 1);
  assert.equal(tierMultiplier({ id: 'g', condition_type: 'points', threshold: 0, multiplier: 3 }), 3);
});

test('progress reports the next unmet tier and remaining metric', () => {
  const p = tierProgress(tiers, { points: 1500, spend: 0, orders: 0 });
  assert.equal(p.current?.id, 'silver');
  assert.equal(p.next?.id, 'gold');
  assert.equal(p.toNext, 3500);
});

test('spend and orders based tiers use their own metric', () => {
  const mixed = [
    { id: 'a', condition_type: 'spend' as const, threshold: 100000, multiplier: 2 },
    { id: 'b', condition_type: 'orders' as const, threshold: 10, multiplier: 2 },
  ];
  assert.equal(computeCustomerTier(mixed, { points: 0, spend: 120000, orders: 3 })?.id, 'a');
  assert.equal(computeCustomerTier(mixed, { points: 0, spend: 0, orders: 12 })?.id, 'b');
  assert.equal(computeCustomerTier(mixed, { points: 0, spend: 0, orders: 2 }), null);
});
