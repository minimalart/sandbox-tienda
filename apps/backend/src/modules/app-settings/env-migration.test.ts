import { test } from 'node:test';
import assert from 'node:assert/strict';
import typesense from './descriptors/typesense';
import delivery from './descriptors/delivery';
import { computeSettingState } from './resolve';
import { planEnvMigration } from './env-migration';
import migrate from '../../scripts/migrate-env-settings';
import { invalidateNamespace } from '../../lib/settings-cache';
import { decryptSecret } from './crypto';
import { __resetSnapshot } from './snapshot';
import type { ExecArgs } from '@medusajs/framework/types';

test('migration command dry-run, encrypted apply, and idempotent rerun', async () => {
  const vars = {
    TYPESENSE_API_KEY: 'migration-test-secret',
    CREDENTIAL_ENCRYPTION_KEY: 'migration-test-encryption-key',
  };
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  invalidateNamespace(typesense.namespace);
  let value: Record<string, unknown> = {};
  let revision = 0;
  const output: string[] = [];
  const store = {
    getSiteSetting: async (namespace: string) => ({ namespace, site_id: null, value, revision }),
    listSiteSettings: async () => [],
    upsertSiteSetting: async (input: {
      namespace: string;
      value: Record<string, unknown>;
      expectedRevision: number;
    }) => {
      assert.equal(input.expectedRevision, revision);
      value = input.value;
      return { namespace: input.namespace, site_id: null, value, revision: ++revision };
    },
  };
  const container = {
    resolve: (key: string) =>
      key === 'logger'
        ? { info: (s: string) => output.push(s), warn: (s: string) => output.push(s) }
        : store,
  };
  try {
    await migrate({ container, args: [typesense.namespace] } as unknown as ExecArgs);
    assert.equal(revision, 0);
    await migrate({ container, args: ['--apply', typesense.namespace] } as unknown as ExecArgs);
    assert.equal(revision, 1);
    const saved = value.TYPESENSE_API_KEY as {
      value: unknown;
      ciphertext: string;
      is_secret: boolean;
    };
    assert.equal(saved.value, null);
    assert.equal(saved.is_secret, true);
    assert.equal(decryptSecret(saved.ciphertext), vars.TYPESENSE_API_KEY);
    assert.ok(!output.join('\n').includes(vars.TYPESENSE_API_KEY));
    await migrate({ container, args: ['--apply', typesense.namespace] } as unknown as ExecArgs);
    assert.equal(revision, 1);
  } finally {
    for (const [key, old] of Object.entries(previous)) {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    }
    invalidateNamespace(typesense.namespace);
    __resetSnapshot();
  }
});

test('migration copies explicit env values including aliases, never defaults or existing overrides', () => {
  const descriptors = [...typesense.settings, ...delivery.settings];
  const env = {
    TYPESENSE_HOST: 'env.host',
    TYPESENSE_PORT: '9200',
    VITE_GOOGLE_MAPS_API_KEY: 'private-example',
  };
  const states = descriptors.map((d) =>
    computeSettingState(d, {}, { envRead: (key) => env[key as keyof typeof env] })
  );
  states.find((s) => s.key === 'TYPESENSE_HOST')!.is_set = true;
  const result = planEnvMigration(descriptors, states, env);
  assert.equal(result.plan.ok, true);
  if (!result.plan.ok) return;
  assert.deepEqual(
    result.plan.writes.map((w) => [w.key, w.value, w.isSecret]),
    [
      ['TYPESENSE_PORT', 9200, false],
      ['GOOGLE_MAPS_API_KEY', 'private-example', true],
    ]
  );
  assert.deepEqual(result.plan.deletes, []);
  assert.ok(!JSON.stringify(result.keys).includes('private-example'));
});

test('invalid env rejects the whole namespace instead of partially saving', () => {
  const env = { TYPESENSE_HOST: 'valid.host', TYPESENSE_PORT: '70000' };
  const states = typesense.settings.map((d) =>
    computeSettingState(d, {}, { envRead: (key) => env[key as keyof typeof env] })
  );
  const result = planEnvMigration(typesense.settings, states, env);
  assert.equal(result.plan.ok, false);
});
