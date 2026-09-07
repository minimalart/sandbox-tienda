import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STRATEGY_CONFIG_DEFAULTS } from '../config';
import { pairMetrics, qualifyPairs, type PairCounts } from './fbt-math';

const GATES = {
  min_orders_analyzed: STRATEGY_CONFIG_DEFAULTS.min_orders_analyzed,
  min_co_occurrences: STRATEGY_CONFIG_DEFAULTS.min_co_occurrences,
  min_confidence: STRATEGY_CONFIG_DEFAULTS.min_confidence,
  min_lift: STRATEGY_CONFIG_DEFAULTS.min_lift,
  max_relations_per_source: STRATEGY_CONFIG_DEFAULTS.max_relations_per_source,
};

const pair = (overrides: Partial<PairCounts> = {}): PairCounts => ({
  source_product_id: 'prod_a',
  target_product_id: 'prod_b',
  co_occurrences: 10,
  source_orders: 20,
  target_orders: 25,
  ...overrides,
});

describe('pairMetrics', () => {
  it('calcula support, confidence y lift', () => {
    // 100 órdenes; A en 20, B en 25, juntos en 10.
    // support = 10/100 = 0.1 · confidence = 10/20 = 0.5 · lift = 0.5 / 0.25 = 2
    const metrics = pairMetrics(pair(), 100);
    assert.equal(metrics.support, 0.1);
    assert.equal(metrics.confidence, 0.5);
    assert.equal(metrics.lift, 2);
  });

  it('lift 1 significa independencia', () => {
    // A en 20 de 100, B en 50 de 100. Si fueran independientes, juntos en 10.
    const metrics = pairMetrics(
      pair({ co_occurrences: 10, source_orders: 20, target_orders: 50 }),
      100,
    );
    assert.equal(metrics.confidence, 0.5);
    assert.equal(metrics.lift, 1);
  });

  it('es direccional: A→B y B→A tienen confianzas distintas', () => {
    // Es la razón por la que se guardan pares ordenados: "quien compra A compra B" no
    // implica "quien compra B compra A".
    const ab = pairMetrics(pair({ co_occurrences: 10, source_orders: 20, target_orders: 100 }), 200);
    const ba = pairMetrics(
      pair({ source_product_id: 'prod_b', target_product_id: 'prod_a', co_occurrences: 10, source_orders: 100, target_orders: 20 }),
      200,
    );
    assert.equal(ab.confidence, 0.5);
    assert.equal(ba.confidence, 0.1);
    assert.equal(ab.support, ba.support); // el support sí es simétrico
  });

  it('devuelve ceros en vez de NaN o Infinity', () => {
    // Un NaN acá terminaría escrito en la columna de score y rompería el orden del
    // serve en silencio.
    for (const metrics of [
      pairMetrics(pair(), 0),
      pairMetrics(pair({ source_orders: 0 }), 100),
      pairMetrics(pair({ target_orders: 0 }), 100),
    ]) {
      assert.ok(Number.isFinite(metrics.support));
      assert.ok(Number.isFinite(metrics.confidence));
      assert.ok(Number.isFinite(metrics.lift));
    }
    assert.equal(pairMetrics(pair({ target_orders: 0 }), 100).lift, 0);
  });
});

describe('qualifyPairs — mínimos de evidencia', () => {
  it('no publica nada por debajo del mínimo de órdenes analizadas', () => {
    // Con 49 órdenes cualquier número "bueno" es casualidad.
    const result = qualifyPairs([pair()], 49, GATES);
    assert.deepEqual(result.qualified, []);
    assert.equal(result.insufficient_data, true);
    assert.equal(result.discarded, 1);
  });

  it('publica a partir del mínimo exacto', () => {
    const result = qualifyPairs([pair({ co_occurrences: 10, source_orders: 20, target_orders: 25 })], 50, GATES);
    assert.equal(result.insufficient_data, false);
    assert.equal(result.qualified.length, 1);
  });

  it('descarta pares por debajo del mínimo de co-ocurrencias', () => {
    const result = qualifyPairs(
      [pair({ co_occurrences: 2, source_orders: 3, target_orders: 3 })],
      100,
      GATES,
    );
    assert.deepEqual(result.qualified, []);
    assert.equal(result.discarded, 1);
  });

  it('el lift NO alcanza por sí solo', () => {
    // Un producto comprado 2 veces, ambas junto a otro, da lift altísimo y no
    // significa nada. El PRD §26 lo prohíbe explícitamente como criterio único.
    const rareButHighLift = pair({ co_occurrences: 2, source_orders: 2, target_orders: 2 });
    const metrics = pairMetrics(rareButHighLift, 100);
    assert.equal(metrics.confidence, 1);
    assert.ok(metrics.lift > 10);
    // Aun así se descarta, porque no alcanza el mínimo de co-ocurrencias.
    assert.deepEqual(qualifyPairs([rareButHighLift], 100, GATES).qualified, []);
  });

  it('descarta por confianza mínima', () => {
    const result = qualifyPairs(
      [pair({ co_occurrences: 5, source_orders: 500, target_orders: 20 })],
      1000,
      { ...GATES, min_confidence: 0.2 },
    );
    assert.deepEqual(result.qualified, []);
  });

  it('descarta por lift mínimo', () => {
    // A en 100 de 200, B en 200 de 200 (todos lo compran): B no es recomendable a
    // partir de A, es simplemente popular. lift = 1 no supera un mínimo de 1.5.
    const result = qualifyPairs(
      [pair({ co_occurrences: 50, source_orders: 100, target_orders: 200 })],
      200,
      { ...GATES, min_lift: 1.5 },
    );
    assert.deepEqual(result.qualified, []);
  });
});

describe('qualifyPairs — recorte y orden', () => {
  it('recorta a max_relations_per_source por producto origen', () => {
    const pairs = Array.from({ length: 30 }, (_, i) =>
      pair({ target_product_id: `prod_t${i}`, co_occurrences: 10 + i, source_orders: 40, target_orders: 40 }),
    );
    const result = qualifyPairs(pairs, 200, { ...GATES, max_relations_per_source: 5 });
    assert.equal(result.qualified.length, 5);
    assert.equal(result.discarded, 25);
  });

  it('recorta por origen y no globalmente', () => {
    const pairs = [
      ...Array.from({ length: 4 }, (_, i) =>
        pair({ source_product_id: 'prod_a', target_product_id: `a${i}`, co_occurrences: 10, source_orders: 40, target_orders: 40 }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        pair({ source_product_id: 'prod_b', target_product_id: `b${i}`, co_occurrences: 10, source_orders: 40, target_orders: 40 }),
      ),
    ];
    const result = qualifyPairs(pairs, 200, { ...GATES, max_relations_per_source: 2 });
    assert.equal(result.qualified.length, 4);
    assert.equal(result.qualified.filter((m) => m.source_product_id === 'prod_a').length, 2);
    assert.equal(result.qualified.filter((m) => m.source_product_id === 'prod_b').length, 2);
  });

  it('ordena por confianza y desempata por co-ocurrencias', () => {
    // `target_orders: 20` sobre 200 órdenes deja P(destino) = 0.1, así que los tres
    // superan el lift mínimo y el test aísla el criterio de ORDEN.
    const pairs = [
      pair({ target_product_id: 'baja', co_occurrences: 10, source_orders: 100, target_orders: 20 }),
      pair({ target_product_id: 'alta', co_occurrences: 30, source_orders: 100, target_orders: 20 }),
      pair({ target_product_id: 'media', co_occurrences: 20, source_orders: 100, target_orders: 20 }),
    ];
    const result = qualifyPairs(pairs, 200, GATES);
    assert.deepEqual(
      result.qualified.map((m) => m.target_product_id),
      ['alta', 'media', 'baja'],
    );
  });

  it('el resultado es determinista ante empate total', () => {
    const pairs = ['zzz', 'aaa', 'mmm'].map((id) =>
      pair({ target_product_id: id, co_occurrences: 10, source_orders: 40, target_orders: 40 }),
    );
    const first = qualifyPairs(pairs, 200, GATES).qualified.map((m) => m.target_product_id);
    const second = qualifyPairs([...pairs].reverse(), 200, GATES).qualified.map((m) => m.target_product_id);
    assert.deepEqual(first, ['aaa', 'mmm', 'zzz']);
    assert.deepEqual(first, second);
  });

  it('con lista vacía no reporta datos insuficientes si hay órdenes', () => {
    const result = qualifyPairs([], 500, GATES);
    assert.deepEqual(result.qualified, []);
    assert.equal(result.insufficient_data, false);
    assert.equal(result.discarded, 0);
  });

  it('distingue "sin datos suficientes" de "éxito con cero relaciones"', () => {
    // La diferencia decide si la versión se activa o no: con datos insuficientes NO
    // se swapea (se conserva la anterior); con cero relaciones legítimas, sí.
    assert.equal(qualifyPairs([], 10, GATES).insufficient_data, true);
    assert.equal(qualifyPairs([], 500, GATES).insufficient_data, false);
  });
});
