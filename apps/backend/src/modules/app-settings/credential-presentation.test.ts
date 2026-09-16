import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allDescriptors, findDescriptor } from './descriptors/index.ts';
import {
  isCredentialSetting,
  isGlobalCredential,
  credentialIntegrationId,
  SITE_ACCOUNT_KEYS,
  isGlobalIntegration,
  INBOUND_CONTRACT_KEYS,
} from './credential-presentation.ts';

test('shared credentials have one owner; the landing model remains extension configuration', () => {
  const global = allDescriptors.filter(isGlobalCredential);
  assert.equal(global.filter((d) => d.key === 'OPENROUTER_API_KEY').length, 1);
  assert.ok(global.every((d) => d.scope === 'instance'));
  const model = findDescriptor('extension:landing-pages', 'OPENROUTER_MODEL');
  assert.ok(model);
  assert.equal(isGlobalCredential(model), false);
  assert.equal(isCredentialSetting(model), false);
});

test('Minimalart provider accounts are global, including the ARCA account CUIT', () => {
  for (const [namespace, key, id] of [
    ['extension:fiscal-documentation', 'ARCA_CUIT_REPRESENTADA', 'arca'],
    ['extension:fiscal-documentation', 'ARCA_CERTIFICATE_BASE64', 'arca'],
    ['extension:fiscal-documentation', 'ARCA_PRIVATE_KEY_BASE64', 'arca'],
    ['extension:videos', 'VIMEO_CLIENT_ID', 'videos'],
    ['extension:videos', 'VIMEO_ACCESS_TOKEN', 'videos'],
    ['extension:typesense', 'TYPESENSE_API_KEY', 'typesense'],
    ['extension:email-templates', 'SENDGRID_API_KEY', 'sendgrid'],
  ]) {
    const d = findDescriptor(namespace, key)!;
    assert.ok(d, key);
    assert.equal(d.scope, 'instance', key);
    assert.equal(isGlobalCredential(d), true, key);
    assert.equal(isGlobalIntegration(id), true, id);
  }
  assert.equal(SITE_ACCOUNT_KEYS.arca, undefined);
  assert.equal(isGlobalCredential(findDescriptor('extension:typesense', 'TYPESENSE_HOST')!), false);
});

test('business toggles stay in extension configuration, secrets move to credentials', () => {
  for (const d of allDescriptors) {
    if (d.type === 'boolean') assert.equal(isCredentialSetting(d), false, d.key);
    if (d.type === 'secret')
      assert.equal(isCredentialSetting(d), !INBOUND_CONTRACT_KEYS.has(d.key), d.key);
  }
});

test('site account fields are removed from extension settings, including non-secret identifiers', () => {
  for (const key of Object.values(SITE_ACCOUNT_KEYS).flat()) {
    const descriptor = allDescriptors.find((d) => d.key === key);
    assert.ok(descriptor, key);
    assert.equal(isCredentialSetting(descriptor), true, key);
  }
  assert.equal(credentialIntegrationId('extension:fiscal-documentation'), 'arca');
  assert.equal(credentialIntegrationId('extension:whatsapp'), 'kapso');
  assert.equal(credentialIntegrationId('extension:loyalty-engine'), 'loyalty');
});

test('the inbound webhook contract stays in the extension card and writes to the instance row', () => {
  for (const key of INBOUND_CONTRACT_KEYS) {
    const d = findDescriptor('extension:whatsapp', key);
    assert.ok(d, key);
    assert.equal(d.type, 'secret', key);
    assert.equal(d.scope, 'instance', key);
    assert.equal(isCredentialSetting(d), false, key);
    assert.equal(isGlobalCredential(d), false, key);
  }
  const account = findDescriptor('extension:whatsapp', 'KAPSO_API_KEY')!;
  assert.equal(isCredentialSetting(account), true);
  assert.equal(account.scope, 'site');
  assert.deepEqual(SITE_ACCOUNT_KEYS.kapso, ['KAPSO_API_KEY']);
});
