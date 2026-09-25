import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';
test('standalone landing plugin and host use the same preview transport and origin checks', () => {
  const root = resolve(import.meta.dirname, '../../../../../..');
  const read = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(read('apps/backend/src/admin/lib/puck/storefront-preview.tsx'), read('packages/plugins/plugin-landing-pages/src/admin/lib/puck/storefront-preview.tsx'));
});
