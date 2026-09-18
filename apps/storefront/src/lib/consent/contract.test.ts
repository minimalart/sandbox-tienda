import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canLoadService,
  effectiveCategories,
  googleConsentMode,
  type ConsentSettings,
} from './contract';
const category = { enabled: true, name: { en: '', es: '' }, description: { en: '', es: '' } };
const settings: ConsentSettings = {
  enabled: true,
  mode: 'opt-in',
  showRejectAll: true,
  showPreferences: true,
  consentRevision: 1,
  localeMode: 'storefront',
  categories: { necessary: category, analytics: category, marketing: category, custom: category },
};
const service = {
  id: 'example',
  name: 'Example',
  category: 'analytics',
  withoutConsent: 'allow' as const,
};
test('opt-in denies optional services until a valid choice, even with an expired accepted cookie', () => {
  assert.deepEqual(effectiveCategories(settings, ['analytics'], false), {
    necessary: true,
    analytics: false,
    marketing: false,
    custom: false,
  });
  assert.equal(
    canLoadService(service, { ready: false, active: true, categories: { analytics: true } }),
    false
  );
});
test('acceptance, rejection and custom categories are independent', () => {
  const categories = effectiveCategories(settings, ['custom'], true);
  assert.equal(categories.custom, true);
  assert.equal(categories.necessary, true);
  assert.equal(canLoadService(service, { active: true, ready: true, categories }), false);
  assert.equal(
    canLoadService({ ...service, category: 'custom' }, { active: true, ready: true, categories }),
    true
  );
  assert.equal(
    canLoadService({ ...service, category: 'unknown' }, { active: true, ready: true, categories }),
    false
  );
});
test('opt-out defaults enabled but honors rejection; disabled categories never activate', () => {
  const config = {
    ...settings,
    mode: 'opt-out' as const,
    categories: { ...settings.categories, marketing: { ...category, enabled: false } },
  };
  assert.equal(effectiveCategories(config, [], false).analytics, true);
  assert.equal(effectiveCategories(config, [], true).analytics, false);
  assert.equal(effectiveCategories(config, ['marketing'], true).marketing, false);
});
test('module absent uses explicit provider policy; informative mode does not gate', () => {
  assert.equal(canLoadService(service, { ready: true, active: false, categories: {} }), true);
  assert.equal(
    canLoadService(
      { ...service, withoutConsent: 'deny' },
      { ready: true, active: false, categories: {} }
    ),
    false
  );
  assert.equal(
    effectiveCategories({ ...settings, mode: 'informational' }, [], true).analytics,
    true
  );
});
test('Google Consent Mode separates analytics from advertising', () => {
  assert.deepEqual(googleConsentMode({ analytics: true, marketing: false }), {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
});
