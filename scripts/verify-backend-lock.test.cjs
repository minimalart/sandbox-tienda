const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

test('lock verification catches a nested old runtime even when root dependencies match', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-lock-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'apps/backend'), { recursive: true });
  const script = join(root, 'scripts/verify-backend-lock.js');
  copyFileSync(join(__dirname, 'verify-backend-lock.js'), script);
  const runtime = '@minimalart/mercatto-plugin-runtime';
  const manifest = { name: 'fixture', version: '1.0.0', dependencies: { [runtime]: '0.6.1' } };
  writeFileSync(join(root, 'apps/backend/package.json'), JSON.stringify(manifest));
  const nested = `node_modules/fixture-plugin/node_modules/${runtime}`;
  const lock = { name: manifest.name, version: manifest.version, lockfileVersion: 3, packages: {
    '': manifest,
    [`node_modules/${runtime}`]: { version: '0.6.1' },
    [nested]: { version: '0.4.0' },
  } };
  const check = () => {
    writeFileSync(join(root, 'apps/backend/package-lock.json'), JSON.stringify(lock));
    return spawnSync(process.execPath, [script], { encoding: 'utf8' });
  };
  const stale = check();
  assert.equal(stale.status, 1);
  assert.ok(stale.stderr.includes(nested));
  lock.packages[nested].version = '0.6.1';
  assert.equal(check().status, 0);
  delete lock.packages[nested];
  assert.equal(check().status, 0, 'runtime without optional plugins is valid');
});
