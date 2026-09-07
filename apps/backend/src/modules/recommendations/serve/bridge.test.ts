import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pair, variant } from './fixtures.test-helpers';
import { bridgeBand, selectBridgeProducts } from './bridge';
import { RECOMMENDATIONS_DEFAULTS } from '../config';
import type { ScoredCandidate } from '../types';

const FACTORS = {
  lower: RECOMMENDATIONS_DEFAULTS.free_shipping.bridge_lower_factor,
  upper: RECOMMENDATIONS_DEFAULTS.free_shipping.bridge_upper_factor,
};

/** Candidato con un precio dado (una variante, con stock). */
const priced = (id: string, amount: number): ScoredCandidate =>
  pair({ id, variants: [variant({ calculated_amount: amount })] });

const ids = (items: ScoredCandidate[]) => items.map((i) => i.candidate.target_product_id);

describe('bridgeBand', () => {
  it('reproduce el ejemplo del PRD (falta $8.000 → $6.000 a $12.000)', () => {
    assert.deepEqual(bridgeBand(8000, FACTORS), {
      target_price: 8000,
      price_min: 6000,
      price_max: 12000,
    });
  });

  it('la banda es asimétrica respecto del faltante', () => {
    // Ofrecer algo más caro que el faltante sirve (igual cruza el umbral); algo
    // mucho más barato, no. De ahí que no sea una tolerancia simétrica.
    const band = bridgeBand(10_000, FACTORS);
    assert.ok(band.target_price - band.price_min < band.price_max - band.target_price);
  });

  it('trata un faltante negativo como cero', () => {
    assert.deepEqual(bridgeBand(-500, FACTORS), { target_price: 0, price_min: 0, price_max: 0 });
  });
});

describe('selectBridgeProducts', () => {
  const band = bridgeBand(8000, FACTORS);

  it('prefiere el más barato que igual cruza el umbral', () => {
    const items = [priced('caro', 11_500), priced('justo', 8200), priced('medio', 9500)];
    assert.deepEqual(ids(selectBridgeProducts(items, band, 4)), ['justo', 'medio', 'caro']);
  });

  it('pone los que cruzan antes que los que se quedan cortos', () => {
    // Aunque el que se queda corto sea más barato: el que cruza resuelve el
    // problema en un solo paso.
    const items = [priced('corto', 7000), priced('cruza', 8500)];
    assert.deepEqual(ids(selectBridgeProducts(items, band, 4)), ['cruza', 'corto']);
  });

  it('entre los que se quedan cortos prefiere el más cerca del umbral', () => {
    const items = [priced('lejos', 6200), priced('cerca', 7900)];
    assert.deepEqual(ids(selectBridgeProducts(items, band, 4)), ['cerca', 'lejos']);
  });

  it('un precio exactamente igual al faltante cuenta como que cruza', () => {
    const items = [priced('exacto', 8000), priced('corto', 7999)];
    assert.deepEqual(ids(selectBridgeProducts(items, band, 4)), ['exacto', 'corto']);
  });

  it('descarta candidatos sin precio de referencia', () => {
    // Sin precio no se puede razonar sobre el umbral.
    const items = [pair({ id: 'sin_precio', variants: [variant({ calculated_amount: null })] }), priced('ok', 8500)];
    assert.deepEqual(ids(selectBridgeProducts(items, band, 4)), ['ok']);
  });

  it('descarta candidatos sin stock (no tienen precio de referencia)', () => {
    const items = [
      pair({ id: 'sin_stock', variants: [variant({ calculated_amount: 8500, available: 0 })] }),
      priced('ok', 8600),
    ];
    assert.deepEqual(ids(selectBridgeProducts(items, band, 4)), ['ok']);
  });

  it('respeta el límite', () => {
    const items = [priced('a', 8100), priced('b', 8200), priced('c', 8300)];
    assert.equal(selectBridgeProducts(items, band, 2).length, 2);
  });

  it('devuelve vacío cuando no hay candidatos', () => {
    assert.deepEqual(selectBridgeProducts([], band, 4), []);
  });

  it('desempata de forma determinista a igual precio', () => {
    const items = [priced('zzz', 8500), priced('aaa', 8500), priced('mmm', 8500)];
    assert.deepEqual(ids(selectBridgeProducts(items, band, 3)), ['aaa', 'mmm', 'zzz']);
  });

  it('no muta la entrada', () => {
    const items = [priced('b', 8500), priced('a', 7000)];
    selectBridgeProducts(items, band, 4);
    assert.deepEqual(ids(items), ['b', 'a']);
  });
});
