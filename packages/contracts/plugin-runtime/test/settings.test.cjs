const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cpSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('physical runtime copies share late registration, replacement and disconnect', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-copies-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const copies = ['host', 'plugin-a', 'plugin-b'].map((id) => {
    const target = join(root, id);
    cpSync(join(__dirname, '../dist'), target, { recursive: true });
    return require(join(target, 'index.js'));
  });
  const [host, ...plugins] = copies;
  assert.notEqual(host, plugins[0], 'must load separate physical modules');
  t.after(() => host.registerAppSettingsSyncReader(null));
  for (const runtime of copies) assert.equal(runtime.getAppSettingsSyncReader(), null);

  let value = 'backoffice-fixture';
  host.registerAppSettingsSyncReader((namespace, key) =>
    namespace === 'extension:ai-assistant' && key === 'OPENROUTER_API_KEY' ? value : undefined);
  for (const runtime of plugins) {
    assert.equal(runtime.getAppSettingsSyncReader()('extension:ai-assistant', 'OPENROUTER_API_KEY'), value);
    assert.equal(runtime.getAppSettingsSyncReader()('other', 'OPENROUTER_API_KEY'), undefined);
  }
  value = 'rotated-fixture';
  assert.equal(plugins[1].getAppSettingsSyncReader()('extension:ai-assistant', 'OPENROUTER_API_KEY'), value);
  plugins[0].registerAppSettingsSyncReader(() => false);
  assert.equal(host.getAppSettingsSyncReader()('ns', 'key'), false);
  host.registerAppSettingsSyncReader(() => 0);
  assert.equal(plugins[1].getAppSettingsSyncReader()('ns', 'key'), 0);
  host.registerAppSettingsSyncReader(null);
  for (const runtime of plugins) assert.equal(runtime.getAppSettingsSyncReader(), null);

  const key = `test/${root}`;
  assert.equal(plugins[0].getExternalReader(key), null);
  host.registerExternalReader(key, () => value);
  assert.equal(plugins[1].getExternalReader(key)(), value);
  plugins[0].registerExternalReader(key, () => null);
  assert.equal(host.getExternalReader(key)(), null);
});
