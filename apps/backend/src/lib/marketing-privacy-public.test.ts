import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicAnalytics, publicConsent } from './marketing-privacy-public';
import {
  defaultConsentSettings,
  validateConsentSettings,
} from '../modules/app-settings/descriptors/consent-management';
import { resolveByPrecedence } from '../modules/app-settings/precedence';
import { permitsUnattributedServerEvent } from './consent-server-policy';
test('server events cannot treat historical client IDs as current visitor consent', () => {
  assert.equal(permitsUnattributedServerEvent(null), true);
  assert.equal(permitsUnattributedServerEvent({ enabled: false, mode: 'opt-in' }), true);
  assert.equal(permitsUnattributedServerEvent({ enabled: true, mode: 'opt-in' }), false);
  assert.equal(permitsUnattributedServerEvent({ enabled: true, mode: 'opt-out' }), false);
  assert.equal(permitsUnattributedServerEvent({ enabled: true, mode: 'informational' }), true);
});
test('public configuration never copies arbitrary private fields', () => {
  const result = publicConsent({
    ...defaultConsentSettings,
    secret: 'private',
    categories: {
      necessary: { ...defaultConsentSettings.categories.necessary, apiKey: 'private' },
    },
  });
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.deepEqual(
    publicAnalytics({
      enabled: false,
      measurementId: '',
      consentCategory: 'analytics',
      apiSecret: 'private',
    }),
    { enabled: false, measurementId: '', consentCategory: 'analytics' }
  );
});
test('necessary, revision and URLs are validated before persistence', () => {
  assert.equal(validateConsentSettings(defaultConsentSettings), null);
  assert.ok(validateConsentSettings({ ...defaultConsentSettings, consentRevision: 0 }));
  assert.ok(
    validateConsentSettings({ ...defaultConsentSettings, privacyPolicyUrl: 'javascript:alert(1)' })
  );
  assert.ok(validateConsentSettings({ ...defaultConsentSettings, categories: {} }));
  assert.ok(
    validateConsentSettings({
      ...defaultConsentSettings,
      categories: { necessary: { ...defaultConsentSettings.categories.necessary, enabled: false } },
    })
  );
});
test('a secondary store never inherits another store analytics; explicit false wins', () => {
  assert.equal(
    resolveByPrecedence({ kind: 'secondary', global: { enabled: true }, env: 'G-MAIN' }).value,
    undefined
  );
  assert.deepEqual(
    resolveByPrecedence({ kind: 'main', site: { enabled: false }, global: { enabled: true } })
      .value,
    { enabled: false }
  );
  assert.equal(
    resolveByPrecedence({ kind: 'main', global: 'G-GLOBAL', env: 'G-ENV' }).value,
    'G-GLOBAL'
  );
  assert.equal(resolveByPrecedence({ kind: 'main', env: 'G-ENV' }).value, 'G-ENV');
});
