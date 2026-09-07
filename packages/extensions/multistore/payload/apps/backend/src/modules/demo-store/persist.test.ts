import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NormalizedProduct } from './importers/types.ts';
import { buildPersistProductPlan } from './persist-plan.ts';

function product(overrides: Partial<NormalizedProduct>): NormalizedProduct {
  return {
    ean: '',
    productId: '1',
    title: 'Product',
    slug: 'product-1',
    description: '',
    brand: null,
    categoryPath: [],
    price: 100,
    listPrice: 100,
    images: [],
    source: 'vtex',
    ...overrides,
  };
}

describe('buildPersistProductPlan', () => {
  it('uses source product identity for sku and only keeps real unique barcodes', () => {
    const plan = buildPersistProductPlan({
      products: [
        product({ productId: '6329', slug: 'campera-6329', ean: '00S' }),
        product({ productId: '7788', slug: 'yerba-7788', ean: '7791234567890' }),
      ],
      salesChannelId: 'sc_demo',
      currencyCode: 'ars',
      existingHandles: new Set(),
      existingSkus: new Set(),
      existingBarcodes: new Set(),
      leafCategoryId: () => null,
    });

    const [equus, depot] = plan.items.map((item) => item.input);

    assert.equal(equus?.variants[0]?.sku, 'vtex-6329');
    assert.equal(equus?.variants[0]?.barcode, undefined);
    assert.equal(depot?.variants[0]?.sku, 'vtex-7788');
    assert.equal(depot?.variants[0]?.barcode, '7791234567890');
  });

  it('does not set a barcode that already exists in the DB', () => {
    const plan = buildPersistProductPlan({
      products: [product({ productId: '7788', slug: 'yerba-7788', ean: '7791234567890' })],
      salesChannelId: 'sc_demo',
      currencyCode: 'ars',
      existingHandles: new Set(),
      existingSkus: new Set(),
      existingBarcodes: new Set(['7791234567890']),
      leafCategoryId: () => null,
    });

    // The product is still created (handle/sku are new), but without a barcode
    // so the variant insert can't trip the unique-barcode constraint.
    assert.equal(plan.items.length, 1);
    assert.equal(plan.items[0]?.input.variants[0]?.barcode, undefined);
    assert.equal(plan.items[0]?.input.variants[0]?.sku, 'vtex-7788');
  });

  it('builds one variant per size when the product carries variants', () => {
    const plan = buildPersistProductPlan({
      products: [
        product({
          productId: '999',
          slug: 'remera-999',
          ean: '1111111111111',
          optionTitle: 'Talle',
          variants: [
            { value: 'S', ean: '1111111111111', price: 100, listPrice: 120 },
            { value: 'M', ean: '2222222222222', price: 110, listPrice: 130 },
          ],
        }),
      ],
      salesChannelId: 'sc_demo',
      currencyCode: 'ars',
      existingHandles: new Set(),
      existingSkus: new Set(),
      existingBarcodes: new Set(),
      leafCategoryId: () => null,
    });

    assert.equal(plan.items.length, 1);
    const input = plan.items[0]!.input;
    assert.deepEqual(input.options, [{ title: 'Talle', values: ['S', 'M'] }]);
    assert.equal(input.variants.length, 2);
    assert.equal(input.variants[0]?.sku, 'vtex-999-s');
    assert.equal(input.variants[1]?.sku, 'vtex-999-m');
    assert.deepEqual(input.variants[0]?.options, { Talle: 'S' });
    assert.deepEqual(input.variants[1]?.options, { Talle: 'M' });
    assert.equal(input.variants[0]?.barcode, '1111111111111');
    assert.equal(input.variants[1]?.barcode, '2222222222222');
    assert.equal(input.variants[0]?.prices[0]?.amount, 100);
    assert.equal(input.variants[1]?.prices[0]?.amount, 110);
  });

  it('counts products skipped by invalid handle and duplicates', () => {
    const plan = buildPersistProductPlan({
      products: [
        product({ productId: '1', slug: 'existing-handle' }),
        product({ productId: '2', slug: 'valid-2' }),
        product({ productId: '2', slug: 'valid-2-copy' }),
        product({ productId: '3', slug: 'Invalid Handle' }),
      ],
      salesChannelId: 'sc_demo',
      currencyCode: 'ars',
      existingHandles: new Set(['existing-handle']),
      existingSkus: new Set(),
      existingBarcodes: new Set(),
      leafCategoryId: () => null,
    });

    assert.equal(plan.items.length, 1);
    assert.deepEqual(plan.skippedReasons, {
      duplicate_sku: 1,
      existing_handle: 1,
      invalid_handle: 1,
    });
  });
});
