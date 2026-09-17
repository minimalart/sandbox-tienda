import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SALES_MODE,
  canBeBundled,
  hiddenProductIds,
  invalidBundleProductIds,
  isSalesMode,
  isSellableStandalone,
  resolveSalesModes,
  toSalesMode,
} from './sales-mode';

test('el default preserva el comportamiento previo: suelto y en bundles', () => {
  assert.equal(DEFAULT_SALES_MODE, 'standalone_and_bundle');
  assert.equal(isSellableStandalone(DEFAULT_SALES_MODE), true);
  assert.equal(canBeBundled(DEFAULT_SALES_MODE), true);
});

test('bundle_only es el único que se esconde del catálogo', () => {
  assert.equal(isSellableStandalone('bundle_only'), false);
  assert.equal(isSellableStandalone('standalone'), true);
  assert.equal(isSellableStandalone('standalone_and_bundle'), true);
});

test('standalone es el único que no debería ir en un bundle', () => {
  assert.equal(canBeBundled('standalone'), false);
  assert.equal(canBeBundled('bundle_only'), true);
  assert.equal(canBeBundled('standalone_and_bundle'), true);
});

test('un valor desconocido en la base cae al default en vez de ocultar el producto', () => {
  assert.equal(toSalesMode('lo-que-sea'), DEFAULT_SALES_MODE);
  assert.equal(toSalesMode(null), DEFAULT_SALES_MODE);
  assert.equal(toSalesMode(undefined), DEFAULT_SALES_MODE);
  assert.equal(isSalesMode('bundle_only'), true);
  assert.equal(isSalesMode('BUNDLE_ONLY'), false);
});

test('hiddenProductIds devuelve sólo los bundle_only', () => {
  const rows = [
    { product_id: 'prod_1', sales_mode: 'bundle_only' },
    { product_id: 'prod_2', sales_mode: 'standalone' },
    { product_id: 'prod_3', sales_mode: 'standalone_and_bundle' },
    { product_id: 'prod_4', sales_mode: 'basura' },
  ];
  assert.deepEqual(hiddenProductIds(rows), ['prod_1']);
});

test('hiddenProductIds no repite ids aunque la base traiga filas duplicadas', () => {
  const rows = [
    { product_id: 'prod_1', sales_mode: 'bundle_only' },
    { product_id: 'prod_1', sales_mode: 'bundle_only' },
  ];
  assert.deepEqual(hiddenProductIds(rows), ['prod_1']);
});

test('resolveSalesModes completa con el default los productos sin fila', () => {
  const modes = resolveSalesModes(
    ['prod_1', 'prod_2'],
    [{ product_id: 'prod_1', sales_mode: 'bundle_only' }],
  );
  assert.equal(modes.get('prod_1'), 'bundle_only');
  assert.equal(modes.get('prod_2'), DEFAULT_SALES_MODE);
  assert.equal(modes.size, 2);
});

test('resolveSalesModes ignora filas de productos que no se preguntaron', () => {
  const modes = resolveSalesModes(
    ['prod_1'],
    [
      { product_id: 'prod_1', sales_mode: 'standalone' },
      { product_id: 'prod_9', sales_mode: 'bundle_only' },
    ],
  );
  assert.deepEqual([...modes.keys()], ['prod_1']);
});

test('invalidBundleProductIds marca los standalone de esa tienda', () => {
  const invalid = invalidBundleProductIds(
    ['prod_1', 'prod_2', 'prod_3'],
    [
      { product_id: 'prod_1', sales_mode: 'standalone' },
      { product_id: 'prod_2', sales_mode: 'bundle_only' },
    ],
  );
  assert.deepEqual(invalid, ['prod_1']);
});

test('sin configuración, ningún producto es inválido para un bundle', () => {
  assert.deepEqual(invalidBundleProductIds(['prod_1', 'prod_2'], []), []);
});

test('el mismo producto puede tener modos distintos en dos tiendas', () => {
  // Las filas ya vienen filtradas por tienda; lo que se prueba es que la
  // función no tiene estado global que las mezcle.
  const enA = resolveSalesModes(['prod_1'], [{ product_id: 'prod_1', sales_mode: 'bundle_only' }]);
  const enB = resolveSalesModes(
    ['prod_1'],
    [{ product_id: 'prod_1', sales_mode: 'standalone_and_bundle' }],
  );
  assert.equal(enA.get('prod_1'), 'bundle_only');
  assert.equal(enB.get('prod_1'), 'standalone_and_bundle');
});

test('sin tienda resuelta (single-tenant) no hay filas y todo se vende suelto', () => {
  assert.deepEqual(hiddenProductIds([]), []);
  assert.equal(resolveSalesModes(['prod_1'], []).get('prod_1'), DEFAULT_SALES_MODE);
});
