import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerAppSettingsSyncReader,
  registerExternalReader,
  EXTERNAL_KEYS,
} from '../../../../../packages/plugins/plugin-runtime/dist/index.js';
import { findDescriptor } from './descriptors';
import { resolveSettingSync } from './resolve';
import { replaceSnapshot, __resetSnapshot } from './snapshot';
import { getLandingAiSettings as landing } from '../../../../../packages/plugins/plugin-landing-pages/src/modules/landing-page/settings';
import { getLandingAiSettings as banner } from '../../../../../packages/plugins/plugin-banners/src/lib/landing-ai/settings';
import { getGiftCardExperienceSettings as gift } from '../../../../../packages/plugins/plugin-gift-cards/src/modules/gift-card-experience/settings';
import { loadArcaSettingsViaPg } from '../../../../../packages/plugins/plugin-fiscal-documentation/src/lib/arca/settings';
import { readSettingsViaPg } from './read-via-pg';
import { encryptSecret } from './crypto';

afterEach(() => {
  registerAppSettingsSyncReader(null);
  registerExternalReader(EXTERNAL_KEYS.APP_SETTINGS_VIA_PG, () => null);
  __resetSnapshot();
});

test('real plugin readers use saved values with no env, and observe later changes including false and zero', () => {
  const previousKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-only-env-removal-encryption-key';
  const encrypted = encryptSecret('test-db-account');
  const rows = (enabled: boolean) =>
    [
      ['extension:ai-assistant', 'OPENROUTER_API_KEY', 'test-db-account'],
      ['extension:landing-pages', 'OPENROUTER_MODEL', 'test/db-model'],
      ['extension:landing-pages', 'LANDING_AI_MAX_RETRIES', 0],
      ['extension:gift-cards', 'GIFT_CARD_EXPERIENCE_ENABLED', enabled],
    ].map(([namespace, key, value]) => ({
      namespace: namespace as string,
      key: key as string,
      value: key === 'OPENROUTER_API_KEY' ? null : value,
      is_secret: key === 'OPENROUTER_API_KEY',
      ciphertext: key === 'OPENROUTER_API_KEY' ? encrypted : null,
      updated_at: null,
      updated_by: null,
    }));
  try {
    registerAppSettingsSyncReader((ns, key) => {
      const d = findDescriptor(ns, key);
      return d ? resolveSettingSync(d) : undefined;
    });
    replaceSnapshot(rows(true));
    for (const read of [landing, banner]) {
      assert.equal(read().apiKey, 'test-db-account');
      assert.equal(read().model, 'test/db-model');
      assert.equal(read().maxRetries, 0);
    }
    assert.equal(gift().experienceEnabled, true);
    replaceSnapshot(rows(false));
    assert.equal(gift().experienceEnabled, false);
  } finally {
    if (previousKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    else process.env.CREDENTIAL_ENCRYPTION_KEY = previousKey;
  }
});

test('ARCA always uses the Minimalart account and ignores legacy store identities', async () => {
  registerExternalReader(EXTERNAL_KEYS.APP_SETTINGS_VIA_PG, () => readSettingsViaPg);
  const entry = (value: string) => ({
    value,
    is_secret: false,
    ciphertext: null,
    updated_at: null,
    updated_by: null,
  });
  const pg = {
    raw: async (_sql: string, bindings?: unknown[]) => ({
      rows: [
        {
          value:
            bindings?.length === 1
              ? {
                  ARCA_CUIT_REPRESENTADA: entry('20111111112'),
                  ARCA_ENVIRONMENT: entry('homologacion'),
                }
              : bindings?.[1] === 'store-a'
                ? {
                    ARCA_CUIT_REPRESENTADA: entry('20333333334'),
                    ARCA_ENVIRONMENT: entry('production'),
                  }
                : {},
        },
      ],
    }),
  };
  const site = (id: string) => ({
    status: 'site' as const,
    site: {
      id,
      slug: id,
      name: id,
      is_main: false,
      channel_ids: [],
      region_id: null,
      stock_location_id: null,
    },
  });
  assert.equal((await loadArcaSettingsViaPg(pg, site('store-a'))).environment, 'homologacion');
  assert.equal((await loadArcaSettingsViaPg(pg, site('store-a'))).cuitRepresentada, '20111111112');
  assert.equal((await loadArcaSettingsViaPg(pg, site('store-b'))).cuitRepresentada, '20111111112');
  await assert.rejects(
    loadArcaSettingsViaPg(
      {
        raw: async () => {
          throw new Error('offline');
        },
      },
      site('store-a')
    ),
    /offline/
  );
});
