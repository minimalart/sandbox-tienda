import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicStoreListing } from './public-listing';

test('directory publishes only ready schools and never exposes private settings', () => {
  const row = { slug: 'north', name: 'Colegio Norte', status: 'ready', is_main: false, sales_channel_id: 'sc_north',
    template_code: 'grocery', theme: { logo: '/logo.svg', internal: 'private' }, source_config: { token: 'synthetic' }, password_gate_password: 'synthetic' };
  assert.deepEqual(publicStoreListing(row), { slug: 'north', name: 'Colegio Norte', canonical_form: 'host', logo: '/logo.svg', template_code: 'grocery' });
  for (const status of ['provisioning', 'importing', 'failed']) assert.equal(publicStoreListing({ ...row, status }), null);
  assert.equal(publicStoreListing({ ...row, is_main: true }), null);
  assert.equal(publicStoreListing({ ...row, sales_channel_id: null }), null);
});
