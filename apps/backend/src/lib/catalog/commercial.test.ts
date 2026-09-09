import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalQuantity,
  validateCanonicalQuantity,
  referenceAmount,
  type CatalogCommercial,
} from './commercial';
const c: CatalogCommercial = {
  version: 1,
  currencyCode: 'ars',
  priceTaxIncluded: true,
  amount: 100,
  listAmount: 120,
  observedAt: '2026-09-07',
  presentation: { mode: 'grouping', unitsPerPackage: 12, priceBasis: 'unit' },
  purchasePolicy: { enabled: true, allowedModes: ['unit', 'package'] },
};
test('24 canonical units versus 2 boxes with own SKU; no double multiplication', () => {
  assert.equal(canonicalQuantity(2, 'package', c), 24);
  assert.equal(
    canonicalQuantity(2, 'package', {
      ...c,
      presentation: { mode: 'own-sku', priceBasis: 'sku', unitsPerPackage: 12 },
    }),
    2
  );
  assert.equal(canonicalQuantity(2, 'unit'), 2);
});
test('missing, disabled and ambiguous configuration is fail closed for conversion', () => {
  for (const commercial of [
    undefined,
    { ...c, purchasePolicy: { enabled: false } },
    {
      ...c,
      presentation: {
        mode: 'grouping' as const,
        unitsPerPackage: 0.75,
        priceBasis: 'unit' as const,
      },
    },
    { ...c, presentation: { mode: 'informational' as const } },
  ])
    assert.throws(() => canonicalQuantity(2, 'package', commercial));
  for (const qty of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => canonicalQuantity(qty, 'unit', c));
});
test('minimum, multiples, overflow and explicit zero are never silently rounded', () => {
  const limited = {
    ...c,
    purchasePolicy: { ...c.purchasePolicy!, minQuantity: 24, quantityStep: 12 },
  };
  assert.throws(() => canonicalQuantity(1, 'package', limited));
  assert.equal(canonicalQuantity(2, 'package', limited), 24);
  assert.throws(() => validateCanonicalQuantity(25, limited));
  assert.throws(() => canonicalQuantity(Number.MAX_SAFE_INTEGER, 'package', c));
  assert.throws(() =>
    validateCanonicalQuantity(24, {
      ...limited,
      purchasePolicy: { enabled: true, quantityStep: 0 },
    })
  );
});
test('list reference requires matching currency and confirmed tax treatment', () => {
  assert.equal(referenceAmount(c, 100, 'ars', true), 120);
  assert.equal(referenceAmount(c, 120, 'ars', true), undefined);
  assert.equal(referenceAmount(c, 100, 'usd', true), undefined);
  assert.equal(referenceAmount(c, 100, 'ars'), undefined);
  assert.equal(referenceAmount(c, 100, 'ars', false), undefined);
  assert.equal(referenceAmount(undefined, 100, 'ars'), undefined);
});
