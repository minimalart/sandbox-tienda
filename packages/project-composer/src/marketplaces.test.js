const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { writeMarketplacesIntegrationFiles } = require('./index');
const { renderAdminI18n } = require('./extension-integrations');
test('shared drawer translations remain available without the optional marketplace plugin', () => {
  for (const selected of [[], ['marketplaces'], ['multistore']]) {
    const source = renderAdminI18n(selected);
    assert.match(source, /translations\/drawer-tabs/);
    assert.match(source, /drawerTabs: drawerTabsEn/);
    assert.match(source, /drawerTabs: drawerTabsEs/);
    assert.doesNotMatch(source, /plugin-marketplaces/);
  }
});
test('omitted marketplace plugin removes its source, dependency and workspace importer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplaces-profile-'));
  try {
    fs.mkdirSync(path.join(root, 'packages/plugins/plugin-marketplaces'), { recursive: true });
    fs.mkdirSync(path.join(root, 'apps/backend'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'apps/backend/package.json'),
      JSON.stringify({
        dependencies: {
          '@minimalart/mercatto-plugin-marketplaces':
            'file:../../packages/plugins/plugin-marketplaces',
          keep: '1.0',
        },
      })
    );
    fs.writeFileSync(
      path.join(root, 'pnpm-lock.yaml'),
      "lockfileVersion: '9.0'\nimporters:\n  apps/backend:\n    dependencies:\n      '@minimalart/mercatto-plugin-marketplaces':\n        specifier: file:../../packages/plugins/plugin-marketplaces\n        version: file:packages/plugins/plugin-marketplaces\n      keep:\n        specifier: '1.0'\n        version: '1.0'\n  packages/plugins/plugin-marketplaces:\n    dependencies:\n      runtime:\n        version: '1.0'\npackages:\n  keep: {}\n"
    );
    writeMarketplacesIntegrationFiles(root, []);
    assert.equal(fs.existsSync(path.join(root, 'packages/plugins/plugin-marketplaces')), false);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(root, 'apps/backend/package.json'))).dependencies[
        '@minimalart/mercatto-plugin-marketplaces'
      ],
      undefined
    );
    assert.doesNotMatch(
      fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'),
      /plugin-marketplaces/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
