import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRuleApplicable,
  pickCampaignMultiplier,
  capByLimits,
  computeExpiryAt,
} from './rules';

const baseCtx = { amount: 1000, customer_id: 'cus_1', now: 1_700_000_000_000 };

test('rule with no conditions always applies to an active rule', () => {
  assert.equal(isRuleApplicable({ id: 'r', status: 'active' }, baseCtx), true);
});

test('inactive rule never applies', () => {
  assert.equal(isRuleApplicable({ id: 'r', status: 'inactive' }, baseCtx), false);
});

test('min_amount gate', () => {
  const rule = { id: 'r', conditions: { min_amount: 2000 } };
  assert.equal(isRuleApplicable(rule, baseCtx), false);
  assert.equal(isRuleApplicable(rule, { ...baseCtx, amount: 2500 }), true);
});

test('sales_channel gate', () => {
  const rule = { id: 'r', conditions: { sales_channel_ids: ['sc_b2c'] } };
  assert.equal(isRuleApplicable(rule, { ...baseCtx, sales_channel_id: 'sc_b2b' }), false);
  assert.equal(isRuleApplicable(rule, { ...baseCtx, sales_channel_id: 'sc_b2c' }), true);
});

test('category gate requires overlap with order items', () => {
  const rule = { id: 'r', conditions: { category_ids: ['cat_wine'] } };
  assert.equal(isRuleApplicable(rule, { ...baseCtx, category_ids: ['cat_beer'] }), false);
  assert.equal(isRuleApplicable(rule, { ...baseCtx, category_ids: ['cat_wine', 'cat_beer'] }), true);
});

test('campaign multiplier: highest priority active campaign wins', () => {
  const now = baseCtx.now;
  const campaigns = [
    { id: 'c1', status: 'active', multiplier: 2, priority: 1 },
    { id: 'c2', status: 'active', multiplier: 3, priority: 5 },
    { id: 'c3', status: 'inactive', multiplier: 10, priority: 9 },
  ];
  assert.equal(pickCampaignMultiplier(campaigns, 'r', now), 3);
});

test('campaign only affects listed rules', () => {
  const now = baseCtx.now;
  const campaigns = [{ id: 'c1', status: 'active', multiplier: 2, priority: 1, affected_rule_ids: ['other'] }];
  assert.equal(pickCampaignMultiplier(campaigns, 'r', now), 1);
});

test('capByLimits enforces lifetime and daily caps', () => {
  assert.equal(capByLimits({ per_customer: 500 }, 300, 400, 0), 100);
  assert.equal(capByLimits({ per_customer: 500 }, 300, 500, 0), 0);
  assert.equal(capByLimits({ per_day: 50 }, 300, 0, 40), 10);
  assert.equal(capByLimits(null, 300, 999, 999), 300);
});

test('computeExpiryAt honors the policy', () => {
  const now = Date.UTC(2026, 5, 1);
  assert.equal(computeExpiryAt({ type: 'none' }, now), null);
  assert.equal(computeExpiryAt(null, now), null);
  assert.equal(computeExpiryAt({ type: 'fixed_days', days: 30 }, now)?.getTime(), now + 30 * 86_400_000);
  assert.equal(computeExpiryAt({ type: 'end_of_year' }, now)?.getTime(), Date.UTC(2026, 11, 31, 23, 59, 59));
});
