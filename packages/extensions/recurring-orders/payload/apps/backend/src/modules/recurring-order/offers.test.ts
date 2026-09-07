import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDiscounts,
  pickDiscount,
  resolveDiscountsForProduct,
} from './offers.ts';

const WEEKLY10 = [{ interval: 'week', count: 1, percentage: 10 }];
const MONTHLY5 = [{ interval: 'month', count: 1, percentage: 5 }];

describe('normalizeDiscounts', () => {
  it('acepta shapes válidos y descarta el resto', () => {
    const result = normalizeDiscounts([
      { interval: 'week', count: 1, percentage: 10 },
      { interval: 'fortnight', count: 1, percentage: 10 }, // interval inválido
      { interval: 'month', count: 0, percentage: 10 }, // count inválido
      { interval: 'month', count: 1, percentage: 0 }, // % nulo
      { interval: 'month', count: 1, percentage: 95 }, // % fuera de rango
      'basura',
      null,
    ]);
    assert.deepEqual(result, [{ interval: 'week', count: 1, percentage: 10 }]);
  });

  it('no-array → vacío', () => {
    assert.deepEqual(normalizeDiscounts(undefined), []);
    assert.deepEqual(normalizeDiscounts('x'), []);
  });
});

describe('pickDiscount', () => {
  it('matchea frecuencia exacta (interval + count)', () => {
    const discounts = normalizeDiscounts([
      { interval: 'week', count: 1, percentage: 10 },
      { interval: 'week', count: 2, percentage: 7 },
    ]);
    assert.equal(pickDiscount(discounts, 'week', 1), 10);
    assert.equal(pickDiscount(discounts, 'week', 2), 7);
    assert.equal(pickDiscount(discounts, 'month', 1), 0);
  });
});

describe('resolveDiscountsForProduct', () => {
  const settings = [
    { sales_channel_id: null, frequency_discounts: MONTHLY5 },
    { sales_channel_id: 'sc_demo', frequency_discounts: WEEKLY10 },
  ];

  it('offer del canal gana sobre todo', () => {
    const offers = [
      {
        product_id: 'prod_a',
        sales_channel_id: 'sc_demo',
        discounts: [{ interval: 'week', count: 1, percentage: 20 }],
        enabled: true,
      },
      { product_id: 'prod_a', sales_channel_id: null, discounts: WEEKLY10, enabled: true },
    ];
    const result = resolveDiscountsForProduct('prod_a', 'sc_demo', offers, settings);
    assert.equal(pickDiscount(result, 'week', 1), 20);
  });

  it('offer global pisa los settings', () => {
    const offers = [
      { product_id: 'prod_a', sales_channel_id: null, discounts: MONTHLY5, enabled: true },
    ];
    const result = resolveDiscountsForProduct('prod_a', 'sc_demo', offers, settings);
    assert.equal(pickDiscount(result, 'month', 1), 5);
    assert.equal(pickDiscount(result, 'week', 1), 0);
  });

  it('offer deshabilitada no cuenta → cae al setting del canal', () => {
    const offers = [
      { product_id: 'prod_a', sales_channel_id: 'sc_demo', discounts: MONTHLY5, enabled: false },
    ];
    const result = resolveDiscountsForProduct('prod_a', 'sc_demo', offers, settings);
    assert.deepEqual(result, WEEKLY10);
  });

  it('sin offers: setting del canal pisa al global por completo (sin merge)', () => {
    const result = resolveDiscountsForProduct('prod_x', 'sc_demo', [], settings);
    assert.deepEqual(result, WEEKLY10);
    assert.equal(pickDiscount(result, 'month', 1), 0);
  });

  it('canal sin fila propia hereda la global; sin nada → vacío', () => {
    const result = resolveDiscountsForProduct('prod_x', 'sc_otro', [], settings);
    assert.deepEqual(result, MONTHLY5);
    assert.deepEqual(resolveDiscountsForProduct('prod_x', null, [], []), []);
  });
});
