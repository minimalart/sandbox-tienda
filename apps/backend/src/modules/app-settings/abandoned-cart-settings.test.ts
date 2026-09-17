import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import descriptor from './descriptors/abandoned-cart';
import { coerceAndValidate } from './validate';
import { resolveByPrecedence } from './precedence';
const ts = createRequire(import.meta.url)('typescript');
const source = ts.transpileModule(
  readFileSync(new URL('./abandoned-cart-settings.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
const exports: any = {};
runInNewContext(source, {
  exports,
  require() {
    return {};
  },
});
const state = (value: unknown, source = 'default') => ({
  namespace: 'extension:abandoned-cart',
  key: 'ABANDONED_CART_WHATSAPP_TEMPLATE_1',
  source,
  value,
  is_set: source === 'site',
});

test('legacy assignments are shown with their actual value until overridden', () => {
  const legacy = [
    { key: 'KAPSO_TEMPLATE_CART_ABANDONED_1', value: 'prior-approved-name', source: 'site' },
  ];
  const result = exports.mergeLegacyCartTemplates([state('none')], legacy);
  assert.equal(result[0].value, 'prior-approved-name');
  assert.equal(result[0].source, 'site');
  assert.equal(result[0].is_set, false);
  assert.equal(exports.mergeLegacyCartTemplates([state('none', 'site')], legacy)[0].value, 'none');
});

test('missing legacy configuration cannot enable a secondary store channel', () => {
  const result = exports.mergeLegacyCartTemplates(
    [state(null, 'off')],
    [{ key: 'KAPSO_TEMPLATE_CART_ABANDONED_1', value: null, source: 'off' }]
  );
  assert.equal(result[0].value, null);
});

test('every recovery setting is scoped and secondary stores cannot inherit global activation', () => {
  assert.ok(descriptor.settings.every((setting) => setting.scope === 'site'));
  const enabled = descriptor.settings.find((setting) => setting.key === 'ABANDONED_CART_ENABLED')!;
  assert.equal(
    resolveByPrecedence({ kind: 'secondary', global: true, env: true, descriptor: enabled }).value,
    undefined
  );
  assert.equal(
    resolveByPrecedence({ kind: 'main', global: true, descriptor: enabled }).value,
    true
  );
  assert.equal(
    resolveByPrecedence({ kind: 'main', site: false, global: true, descriptor: enabled }).value,
    false
  );
});

test('cron is validated before persistence', () => {
  const cron = descriptor.settings.find((setting) => setting.key === 'ABANDONED_CART_SCAN_CRON')!;
  assert.equal(coerceAndValidate(cron, '*/15 9-18 * * 1-5').ok, true);
  for (const expression of ['61 * * * *', '*/0 * * * *', 'bad'])
    assert.equal(coerceAndValidate(cron, expression).ok, false);
});
