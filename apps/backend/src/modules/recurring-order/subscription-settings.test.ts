import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSubscriptionFeatureEnabled } from './settings.ts';
import { __resetSnapshot, replaceSnapshot } from '../app-settings/snapshot.ts';

test('saved subscription toggle overrides legacy environment immediately, including disabling payments', () => {
  const key = 'SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED';
  const original = process.env[key];
  process.env[key] = 'true';
  try {
    __resetSnapshot();
    assert.equal(isSubscriptionFeatureEnabled(key), true);
    const row = {
      namespace: 'extension:recurring-orders',
      key,
      value: false,
      is_secret: false,
      ciphertext: null,
      updated_at: null,
      updated_by: null,
    };
    replaceSnapshot([row]);
    assert.equal(isSubscriptionFeatureEnabled(key), false);
    replaceSnapshot([{ ...row, value: true }]);
    assert.equal(isSubscriptionFeatureEnabled(key), true);
  } finally {
    __resetSnapshot();
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});
