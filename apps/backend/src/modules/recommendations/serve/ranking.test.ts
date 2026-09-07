import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pair } from './fixtures.test-helpers';
import { rankCandidates, resolveChain } from './ranking';
import type { ResolvedTier, ScoredCandidate } from '../types';

const ids = (items: ScoredCandidate[]) => items.map((i) => i.candidate.target_product_id);

const tier = (strategy_key: string, count: number): ResolvedTier => ({
  strategy_key,
  kept: Array.from({ length: count }, (_, i) => pair({ id: `${strategy_key}_${i}` })),
});

describe('rankCandidates', () => {
  it('la prioridad manual gana sobre el score automático', () => {
    // Es el control explícito del merchant: tiene que poder imponerse sobre
    // cualquier cálculo, por alto que sea el score.
    const items = [
      pair({ id: 'auto' }, { priority: 0, score: 0.99 }),
      pair({ id: 'manual' }, { priority: 10, score: 0.01 }),
    ];
    assert.deepEqual(ids(rankCandidates(items)), ['manual', 'auto']);
  });

  it('a igual prioridad ordena por score descendente', () => {
    const items = [
      pair({ id: 'bajo' }, { priority: 5, score: 0.1 }),
      pair({ id: 'alto' }, { priority: 5, score: 0.8 }),
    ];
    assert.deepEqual(ids(rankCandidates(items)), ['alto', 'bajo']);
  });

  it('desempata por co-ocurrencias y deja los null al final', () => {
    const items = [
      pair({ id: 'sin_evidencia' }, { score: 0.5, co_occurrences: null }),
      pair({ id: 'poca' }, { score: 0.5, co_occurrences: 3 }),
      pair({ id: 'mucha' }, { score: 0.5, co_occurrences: 40 }),
    ];
    assert.deepEqual(ids(rankCandidates(items)), ['mucha', 'poca', 'sin_evidencia']);
  });

  it('el orden es determinista ante empate total', () => {
    // Sin este desempate dos requests idénticos devuelven órdenes distintas y la
    // métrica de posición deja de significar algo.
    const items = [pair({ id: 'zzz' }), pair({ id: 'aaa' }), pair({ id: 'mmm' })];
    assert.deepEqual(ids(rankCandidates(items)), ['aaa', 'mmm', 'zzz']);
  });

  it('es estable ante permutaciones de la entrada', () => {
    const build = () => [
      pair({ id: 'a' }, { priority: 1, score: 0.2 }),
      pair({ id: 'b' }, { priority: 1, score: 0.9 }),
      pair({ id: 'c' }, { priority: 3, score: 0.1 }),
    ];
    const forward = ids(rankCandidates(build()));
    const reversed = ids(rankCandidates(build().reverse()));
    assert.deepEqual(forward, reversed);
    assert.deepEqual(forward, ['c', 'b', 'a']);
  });

  it('no muta la entrada', () => {
    const items = [pair({ id: 'b' }), pair({ id: 'a' })];
    rankCandidates(items);
    assert.deepEqual(ids(items), ['b', 'a']);
  });
});

describe('resolveChain', () => {
  it('no usa fallback cuando el primer tier alcanza el mínimo', () => {
    const resolution = resolveChain([tier('fbt', 8), tier('popular', 8)], { limit: 8, minResults: 4 });
    assert.equal(resolution.resolved_strategy_key, 'fbt');
    assert.equal(resolution.fallback_used, false);
    assert.equal(resolution.tier_index, 0);
    assert.equal(resolution.items.length, 8);
  });

  it('cae al segundo tier cuando el primero no llega al mínimo', () => {
    const resolution = resolveChain([tier('fbt', 1), tier('similar', 6)], { limit: 8, minResults: 4 });
    assert.equal(resolution.resolved_strategy_key, 'similar');
    assert.equal(resolution.fallback_used, true);
    assert.equal(resolution.tier_index, 1);
  });

  it('recorre toda la cadena hasta encontrar uno que sirva', () => {
    const resolution = resolveChain([tier('fbt', 0), tier('manual', 0), tier('popular', 5)], {
      limit: 8,
      minResults: 4,
    });
    assert.equal(resolution.resolved_strategy_key, 'popular');
    assert.equal(resolution.tier_index, 2);
    assert.equal(resolution.fallback_used, true);
  });

  it('con todos por debajo del mínimo devuelve el mejor esfuerzo', () => {
    // Mostrar 3 recomendaciones relevantes es mejor que no mostrar nada.
    const resolution = resolveChain([tier('fbt', 1), tier('similar', 3), tier('popular', 2)], {
      limit: 8,
      minResults: 6,
    });
    assert.equal(resolution.resolved_strategy_key, 'similar');
    assert.equal(resolution.items.length, 3);
    assert.equal(resolution.fallback_used, true);
  });

  it('ante empate en el mejor esfuerzo gana el tier más específico', () => {
    const resolution = resolveChain([tier('fbt', 2), tier('popular', 2)], { limit: 8, minResults: 6 });
    assert.equal(resolution.resolved_strategy_key, 'fbt');
    assert.equal(resolution.tier_index, 0);
    assert.equal(resolution.fallback_used, false);
  });

  it('con todos los tiers vacíos devuelve una resolución nula', () => {
    const resolution = resolveChain([tier('fbt', 0), tier('popular', 0)], { limit: 8, minResults: 1 });
    assert.equal(resolution.resolved_strategy_key, null);
    assert.equal(resolution.fallback_used, false);
    assert.equal(resolution.tier_index, -1);
    assert.deepEqual(resolution.items, []);
  });

  it('con una cadena vacía devuelve una resolución nula', () => {
    const resolution = resolveChain([], { limit: 8, minResults: 1 });
    assert.equal(resolution.resolved_strategy_key, null);
    assert.deepEqual(resolution.items, []);
  });

  it('recorta al límite pedido', () => {
    const resolution = resolveChain([tier('popular', 30)], { limit: 4, minResults: 1 });
    assert.equal(resolution.items.length, 4);
  });

  it('nunca exige más resultados que el límite', () => {
    // Un minResults mayor al limit haría que ningún tier "alcance" el mínimo y todo
    // cayera por el camino del mejor esfuerzo.
    const resolution = resolveChain([tier('fbt', 3), tier('popular', 9)], { limit: 3, minResults: 9 });
    assert.equal(resolution.resolved_strategy_key, 'fbt');
    assert.equal(resolution.fallback_used, false);
  });

  it('trata minResults menor a 1 como 1', () => {
    const resolution = resolveChain([tier('fbt', 1)], { limit: 8, minResults: 0 });
    assert.equal(resolution.resolved_strategy_key, 'fbt');
    assert.equal(resolution.fallback_used, false);
  });
});
