import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEarnedPoints } from './earn';

test('fixed awards a flat amount regardless of order total', () => {
  assert.equal(computeEarnedPoints({ calc_type: 'fixed', calc_value: 250 }, 9999), 250);
});

test('percentage: rate 10% of a $1000 order = 100 points', () => {
  assert.equal(computeEarnedPoints({ calc_type: 'percentage', calc_value: 10 }, 1000), 100);
});

test('multiplier: 1 point per currency unit', () => {
  assert.equal(computeEarnedPoints({ calc_type: 'multiplier', calc_value: 1 }, 1500), 1500);
});

test('campaign multiplier doubles the earned points', () => {
  assert.equal(computeEarnedPoints({ calc_type: 'percentage', calc_value: 10 }, 1000, 2), 200);
});

test('result is floored to whole points', () => {
  // 3.5% of 150 = 5.25 → 5
  assert.equal(computeEarnedPoints({ calc_type: 'percentage', calc_value: 3 }, 150), 4);
});

test('never returns negative points', () => {
  assert.equal(computeEarnedPoints({ calc_type: 'fixed', calc_value: -100 }, 0), 0);
});
