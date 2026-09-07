import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appSettingsSiteHeaders } from './app-settings-scope';

test('global settings clear a previously selected store without changing site-specific requests', () => {
  const cached = { 'x-site-id': 'store-a' };
  assert.equal({ ...cached, ...appSettingsSiteHeaders(null) }['x-site-id'], '*');
  assert.equal(appSettingsSiteHeaders(undefined)['x-site-id'], '*');
  assert.equal(appSettingsSiteHeaders('store-b')['x-site-id'], 'store-b');
});
