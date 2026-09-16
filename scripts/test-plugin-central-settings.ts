/** Contract test of packed/published artifacts, never workspace plugin sources.
 * Run with the backend's test-register.mjs hook. Storage and OpenRouter are fixtures;
 * the admin write service, encryption, snapshot resolver and packaged clients are real.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyPlan, getStates } from '../apps/backend/src/modules/app-settings/service.ts';
import { buildWritePlan } from '../apps/backend/src/modules/app-settings/write-plan.ts';
import { findDescriptor, findNamespace } from '../apps/backend/src/modules/app-settings/descriptors/index.ts';
import { resolveSettingSync } from '../apps/backend/src/modules/app-settings/resolve.ts';
import { __resetSnapshot } from '../apps/backend/src/modules/app-settings/snapshot.ts';
import type { SiteSettingsStoreLike } from '../apps/backend/src/modules/app-settings/site-setting-store.ts';
import type { MedusaContainer } from '@medusajs/framework/types';

const [runtimeArchive, pluginArchive, pluginId] = process.argv.slice(2);
assert.ok(runtimeArchive && pluginArchive && ['banners', 'landing-pages'].includes(pluginId),
  'usage: test-plugin-central-settings.ts <runtime.tgz> <plugin.tgz> banners|landing-pages');
const root = mkdtempSync(join(tmpdir(), 'published-settings-'));
const savedEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const require = createRequire(import.meta.url);
const namespace = 'extension:ai-assistant';
const key = 'OPENROUTER_API_KEY';
const envKeys = [key, 'OPENROUTER_MODEL', 'OPENROUTER_SITE_URL', 'LANDING_AI_MAX_RETRIES', 'APP_SETTINGS_DISABLE'];
let host: any;
try {
  for (const name of envKeys) delete process.env[name];
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'contract-test-only-encryption';
  const unpack = (archive: string, name: string) => {
    const target = join(root, name);
    mkdirSync(target);
    execFileSync('tar', ['-xzf', resolve(archive), '-C', target]);
    return join(target, 'package');
  };
  const runtime = unpack(runtimeArchive, 'host');
  const plugin = unpack(pluginArchive, 'plugin');
  const nested = join(plugin, 'node_modules/@minimalart/mercatto-plugin-runtime');
  cpSync(runtime, nested, { recursive: true });
  host = require(runtime);
  const pluginRuntime = require(nested);
  assert.notEqual(host, pluginRuntime, 'host and plugin must use separate physical modules');
  const manifest = JSON.parse(readFileSync(join(plugin, 'package.json'), 'utf8'));
  const runtimeVersion = JSON.parse(readFileSync(join(runtime, 'package.json'), 'utf8')).version;
  assert.equal(manifest.dependencies['@minimalart/mercatto-plugin-runtime'], `^${runtimeVersion}`);
  const base = join(plugin, '.medusa/server/src');
  const settings = require(join(base, pluginId === 'banners' ? 'lib/landing-ai/settings.js' : 'modules/landing-page/settings.js'));
  const clients = join(base, pluginId === 'banners' ? 'lib/landing-ai' : 'modules/landing-page/ai');
  const text = require(join(clients, 'client.js'));
  const image = require(join(clients, 'image-client.js'));
  assert.equal(settings.getLandingAiSettings().apiKey, '');
  assert.equal(text.isAiConfigured(), false);
  let requestCount = 0;
  let expectedSecret = '';
  globalThis.fetch = async (_url, init) => {
    requestCount++;
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${expectedSecret}`);
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: body.modalities
      ? { images: [{ image_url: { url: 'data:image/png;base64,aGVsbG8=' } }] }
      : { content: '{"ok":true}' } }] }), { status: 200 });
  };
  await assert.rejects(() => text.callOpenRouter([{ role: 'user', content: 'fixture' }]), (e: any) => e.status === 503 || e.statusCode === 503);
  await assert.rejects(() => image.generateImage({ prompt: 'fixture' }), (e: any) => e.status === 503 || e.statusCode === 503);
  assert.equal(requestCount, 0);

  // The same service and persistence contract called by POST /admin/app-settings.
  const rows = new Map<string, any>();
  const slot = (ns: string, siteId: string | null = null) => `${ns}/${siteId ?? 'global'}`;
  const store: SiteSettingsStoreLike = {
    async getSiteSetting(ns, siteId = null) {
      return rows.get(slot(ns, siteId)) ?? { namespace: ns, site_id: siteId, revision: 0, value: {} };
    },
    async listSiteSettings(filter) { return rows.has(slot(filter.namespace, filter.site_id)) ? [{ id: 'fixture' }] : []; },
    async upsertSiteSetting(input) {
      const current = await this.getSiteSetting(input.namespace, input.siteId);
      assert.equal(input.expectedRevision, current.revision);
      const row = { namespace: input.namespace, site_id: input.siteId ?? null, revision: current.revision + 1, value: input.value };
      rows.set(slot(input.namespace, input.siteId), row);
      return row;
    },
  };
  const container = { resolve: () => store } as unknown as MedusaContainer;
  const save = async (ns: string, values?: Record<string, unknown>, unset?: string[]) => {
    const descriptors = findNamespace(ns)!.settings;
    const plan = buildWritePlan({ descriptors, values, unset });
    assert.equal(plan.ok, true);
    if (!plan.ok) throw new Error('invalid fixture');
    await applyPlan(container, { namespace: ns, descriptors, plan, actorId: 'fixture-admin' });
    return getStates(container, descriptors);
  };
  host.registerAppSettingsSyncReader((ns: string, name: string) => {
    const descriptor = findDescriptor(ns, name);
    return descriptor ? resolveSettingSync(descriptor) : undefined;
  });
  for (const secret of ['saved-only-in-backoffice', 'rotated-in-backoffice']) {
    expectedSecret = secret;
    const states = await save(namespace, { [key]: secret });
    assert.equal(states.find((state) => state.key === key)?.value, null, 'admin must remain write-only');
    assert.ok(!JSON.stringify(rows.get(slot(namespace))).includes(secret), 'storage must contain ciphertext only');
    assert.equal(process.env[key], undefined);
    assert.equal(settings.getLandingAiSettings().apiKey, secret);
    assert.equal(text.isAiConfigured(), true);
    assert.equal(await text.callOpenRouter([{ role: 'user', content: 'fixture' }]), '{"ok":true}');
    const generated = await image.generateImage({ prompt: 'fixture' });
    assert.equal(generated.mimeType, 'image/png');
    assert.ok(generated.bytes.length > 0);
  }
  await save('extension:landing-pages', { OPENROUTER_MODEL: 'fixture/another-model', LANDING_AI_MAX_RETRIES: 0 });
  assert.equal(settings.getLandingAiSettings().model, 'fixture/another-model');
  assert.equal(settings.getLandingAiSettings().maxRetries, 0);
  await save(namespace, undefined, [key]);
  assert.equal(settings.getLandingAiSettings().apiKey, '');
  assert.equal(text.isAiConfigured(), false);
  assert.equal(requestCount, 4);
  // Legacy standalone hosts still have the existing env fallback.
  host.registerAppSettingsSyncReader(null);
  process.env[key] = 'standalone-fixture';
  assert.equal(settings.getLandingAiSettings().apiKey, 'standalone-fixture');
  console.log(`${manifest.name}@${manifest.version}: packed clients pass central settings, rotation, removal, defaults and text/image authorization with runtime ${runtimeVersion}.`);
} finally {
  host?.registerAppSettingsSyncReader(null);
  __resetSnapshot();
  globalThis.fetch = originalFetch;
  for (const name of [...envKeys, 'CREDENTIAL_ENCRYPTION_KEY']) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
  rmSync(root, { recursive: true, force: true });
}
