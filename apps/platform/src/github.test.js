const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeAdminHookIndex, mergeAdminI18n, mergeMiddlewareRegistry } = require('./github');

test('extension middleware integration is added once', () => {
  const initial = "import type { MiddlewareRoute } from '@medusajs/medusa';\n\nexport const extensionMiddlewares: MiddlewareRoute[] = [\n];\n";
  const definition = [['./admin/brands/middlewares', 'adminBrandsMiddlewares']];
  const updated = mergeMiddlewareRegistry(initial, definition);
  assert.match(updated, /import \{ adminBrandsMiddlewares \}/);
  assert.match(updated, /\.\.\.adminBrandsMiddlewares,/);
  assert.equal(mergeMiddlewareRegistry(updated, definition), updated);
});

test('admin hook barrel is extended idempotently', () => {
  const initial = "export * from './variants';\n";
  const updated = mergeAdminHookIndex(initial, ['brands']);
  assert.match(updated, /brands/);
  assert.equal(mergeAdminHookIndex(updated, ['brands']), updated);
});

test('Admin translations are extended for both languages once', () => {
  const initial = "import { en as widgetsEn, es as widgetsEs } from '../translations/widgets';\n\nexport default {\n  en: {\n    widgets: widgetsEn,\n  },\n  es: {\n    widgets: widgetsEs,\n  },\n};\n";
  const updated = mergeAdminI18n(initial, ['brands', 'brands']);
  assert.match(updated, /translations\/brands/);
  assert.match(updated, /brands: brandsEn/);
  assert.match(updated, /brands: brandsEs/);
  assert.equal(mergeAdminI18n(updated, ['brands', 'brands']), updated);
});
