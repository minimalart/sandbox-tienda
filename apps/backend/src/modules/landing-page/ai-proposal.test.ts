// Run plugin regressions from the host's existing test command as well.
import '../../../../../packages/plugins/plugin-landing-pages/src/modules/landing-page/preview.test';
import '../../../../../packages/plugins/plugin-landing-pages/src/modules/landing-page/ai/catalog-validation.test';
import '../../../../../packages/plugins/plugin-landing-pages/src/modules/landing-page/ai/generator.test';
import '../../../../../packages/plugins/plugin-landing-pages/src/admin/lib/landing-images.test';
import '../../../../../packages/plugins/plugin-landing-pages/src/modules/landing-page/ai/routes.test';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  en,
  es,
} from '../../../../../packages/plugins/plugin-landing-pages/src/admin/translations/landing-pages';
import { buildQueryByFields } from '../../../../../packages/plugins/plugin-landing-pages/src/modules/landing-page/ai/search-query';
import { buildQueryByFields as storefrontQuery } from '../../../../storefront/src/lib/typesense/core/query-by';

test('landing catalog verification uses the storefront search fields and relevance configuration', () => {
  assert.deepEqual(buildQueryByFields(), storefrontQuery());
});

test('new proposal controls have matching English and Spanish translation keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
});

for (const file of ['generator.ts', 'prompts.ts', 'puck-schema.ts']) {
  test(`host and plugin keep the shared AI contract in sync: ${file}`, () => {
    const host = readFileSync(new URL(`./ai/${file}`, import.meta.url), 'utf8').replace(
      /\r\n/g,
      '\n'
    );
    const plugin = readFileSync(
      new URL(
        `../../../../../packages/plugins/plugin-landing-pages/src/modules/landing-page/ai/${file}`,
        import.meta.url
      ),
      'utf8'
    ).replace(/\r\n/g, '\n');
    assert.equal(host, plugin);
  });
}
