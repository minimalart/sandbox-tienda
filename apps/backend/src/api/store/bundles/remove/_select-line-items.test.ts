import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBundleInstanceLineItemIds } from './_select-line-items';

const items = [
  { id: 'li_a', metadata: { bundle_instance_id: 'bi_1' } },
  { id: 'li_b', metadata: { bundle_instance_id: 'bi_1' } },
  { id: 'li_c', metadata: { bundle_instance_id: 'bi_2' } },
  { id: 'li_d', metadata: null },
  { id: 'li_e' },
];

test('devuelve sólo las líneas de la instancia pedida', () => {
  assert.deepEqual(selectBundleInstanceLineItemIds(items, 'bi_1'), ['li_a', 'li_b']);
  assert.deepEqual(selectBundleInstanceLineItemIds(items, 'bi_2'), ['li_c']);
});

test('instancia desconocida o vacía → ninguna línea', () => {
  assert.deepEqual(selectBundleInstanceLineItemIds(items, 'bi_zzz'), []);
  assert.deepEqual(selectBundleInstanceLineItemIds(items, ''), []);
  assert.deepEqual(selectBundleInstanceLineItemIds(undefined, 'bi_1'), []);
});
