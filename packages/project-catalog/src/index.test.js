const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProjectSelection, validateCatalog } = require('./index');

test('legacy importer selection resolves to Tiendas without a separate extension', () => {
  const legacy = resolveProjectSelection({ template: 'grocery', extensions: ['store-importer'] });
  const current = resolveProjectSelection({ template: 'grocery', extensions: ['multistore'] });
  assert.deepEqual(legacy, current);
  assert.ok(!legacy.extensions.some(extension => extension.id === 'store-importer'));
});

test('catalog has no missing dependencies or cycles', () => {
  assert.deepEqual(validateCatalog(), { valid: true, errors: [] });
});

test('selection includes template requirements and transitive dependencies', () => {
  const selection = resolveProjectSelection({ template: 'sports', extensions: ['banners'] });
  assert.equal(selection.template.id, 'sports');
  const ids = selection.extensions.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const required of ['banners', 'media-library', 'typesense', 'wishlist']) {
    assert.ok(ids.includes(required), `missing ${required}`);
  }
});
