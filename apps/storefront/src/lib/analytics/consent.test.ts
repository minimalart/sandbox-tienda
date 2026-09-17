import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureAnalytics, initializeAnalytics } from './runtime';
import { trackPageView, trackViewItem } from './gtag';

test('GA4 requires consent, sends defaults before config, stops on revocation, and targets the selected store', () => {
  const calls: unknown[][] = [];
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  Object.assign(globalThis, {
    window: {
      location: { href: 'https://store.test/a' },
      gtag: (...args: unknown[]) => calls.push(args),
    },
    document: { title: 'Test' },
  });
  try {
    const config = { enabled: true, measurementId: 'G-STOREA', consentCategory: 'analytics' };
    assert.equal(configureAnalytics(config, { active: true, ready: false, categories: {} }), false);
    initializeAnalytics();
    trackPageView('/blocked');
    assert.deepEqual(
      calls.map((c) => c[0]),
      ['consent']
    );
    assert.equal(
      configureAnalytics(config, { active: true, ready: true, categories: { analytics: true } }),
      true
    );
    initializeAnalytics();
    trackPageView('/a');
    trackPageView('/b');
    assert.deepEqual(
      calls.map((c) => c[0]),
      ['consent', 'consent', 'js', 'config', 'event', 'event']
    );
    configureAnalytics(config, { active: true, ready: true, categories: { analytics: false } });
    const before = calls.length;
    trackViewItem({ item: { item_id: 'item', item_name: 'Test' } });
    trackPageView('/revoked');
    assert.equal(calls.length, before);
    assert.equal((window as unknown as Record<string, unknown>)['ga-disable-G-STOREA'], true);
    configureAnalytics(
      { ...config, measurementId: 'G-STOREB' },
      { active: false, ready: true, categories: {} }
    );
    initializeAnalytics();
    trackPageView('/b');
    assert.equal((calls.at(-1)?.[2] as Record<string, unknown>).send_to, 'G-STOREB');
    assert.equal((window as unknown as Record<string, unknown>)['ga-disable-G-STOREA'], true);
  } finally {
    Object.assign(globalThis, { window: originalWindow, document: originalDocument });
  }
});
