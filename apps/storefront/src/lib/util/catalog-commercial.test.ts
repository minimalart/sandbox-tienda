import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogListAmount,
  presentationFactor,
  presentationSummary,
  type CatalogCommercial,
} from './catalog-commercial';

const commercial: CatalogCommercial = {
  version: 1,
  currencyCode: 'ars',
  priceTaxIncluded: false,
  amount: 100,
  listAmount: 120,
  presentation: { mode: 'grouping', unitsPerPackage: 12, priceBasis: 'unit' },
  purchasePolicy: { enabled: true, allowedModes: ['unit', 'package'] },
};
test('reference price requires matching currency and explicit tax treatment', () => {
  const variant = {
    metadata: { catalog_commercial: commercial },
    calculated_price: {
      currency_code: 'ars',
      calculated_amount: 100,
      is_calculated_price_tax_inclusive: false,
    },
  };
  assert.equal(catalogListAmount(variant), 120);
  assert.equal(
    catalogListAmount({
      ...variant,
      calculated_price: { ...variant.calculated_price, currency_code: 'usd' },
    }),
    undefined
  );
  assert.equal(
    catalogListAmount({
      ...variant,
      calculated_price: { ...variant.calculated_price, is_calculated_price_tax_inclusive: true },
    }),
    undefined
  );
  assert.equal(
    catalogListAmount({
      ...variant,
      metadata: { catalog_commercial: { ...commercial, priceTaxIncluded: undefined } },
    }),
    undefined
  );
  assert.equal(
    catalogListAmount({
      ...variant,
      calculated_price: { ...variant.calculated_price, calculated_amount: 120 },
    }),
    undefined
  );
  assert.equal(catalogListAmount({}), undefined);
});
test('historical snapshots remain readable independently of enabled purchase policy', () => {
  assert.equal(
    presentationSummary({ catalog_presentation: commercial.presentation }, 24),
    '2 bultos × 12 = 24 unidades'
  );
  assert.equal(
    presentationSummary(
      { catalog_presentation: { mode: 'own-sku', label: 'cajas', unitsPerPackage: 12 } },
      2
    ),
    '2 cajas · 12 unidades por presentación'
  );
  assert.equal(presentationSummary({}, 2), null);
  assert.equal(presentationFactor(commercial), 12);
  assert.equal(presentationFactor({ ...commercial, purchasePolicy: { enabled: false } }), 1);
  assert.equal(
    presentationFactor({
      ...commercial,
      presentation: { mode: 'own-sku', unitsPerPackage: 12, priceBasis: 'sku' },
    }),
    1
  );
});
