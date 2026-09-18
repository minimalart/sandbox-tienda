import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateBundleSchema,
  ListBundlesQuerySchema,
  UpdateBundleSchema,
} from './schemas';

test('CreateBundleSchema: acepta payload mínimo válido', () => {
  const parsed = CreateBundleSchema.parse({
    title: 'Kit 4.º grado',
    handle: 'kit-4-grado',
  });
  assert.equal(parsed.status, 'draft');
});

test('CreateBundleSchema: rechaza handle en mayúsculas o con espacios', () => {
  for (const bad of ['Kit-4', 'kit 4', 'kit_4', 'Kit4Grado']) {
    assert.throws(
      () => CreateBundleSchema.parse({ title: 'x', handle: bad }),
      /handle/,
    );
  }
});

test('CreateBundleSchema: rechaza items con quantity <= 0', () => {
  assert.throws(() =>
    CreateBundleSchema.parse({
      title: 'x',
      handle: 'x',
      items: [{ product_id: 'prod_1', quantity: 0 }],
    }),
  );
});

test('UpdateBundleSchema: omite handle a propósito (rename rompe URLs)', () => {
  const parsed = UpdateBundleSchema.parse({ title: 'x', handle: 'nuevo-handle' });
  // `handle` es strippeado por Zod, no persiste.
  assert.equal((parsed as any).handle, undefined);
});

test('ListBundlesQuerySchema: coerce limit/offset desde strings de la query', () => {
  const parsed = ListBundlesQuerySchema.parse({ limit: '10', offset: '0' });
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.offset, 0);
});

test('ListBundlesQuerySchema: cap del limit para no colgar la DB', () => {
  assert.throws(() => ListBundlesQuerySchema.parse({ limit: '9999' }));
});
