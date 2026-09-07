import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RECOMMENDATIONS_DEFAULTS,
  RECOMMENDATIONS_HARD_CAPS,
  STRATEGY_CONFIG_DEFAULTS,
  STRATEGY_HARD_CAPS,
  mergeRecommendationsConfig,
  mergeStrategyConfig,
} from './config';

describe('mergeRecommendationsConfig', () => {
  it('nunca devuelve un valor parcial', () => {
    const merged = mergeRecommendationsConfig({});
    assert.deepEqual(Object.keys(merged).sort(), Object.keys(RECOMMENDATIONS_DEFAULTS).sort());
    assert.deepEqual(
      Object.keys(merged.free_shipping).sort(),
      Object.keys(RECOMMENDATIONS_DEFAULTS.free_shipping).sort(),
    );
  });

  it('tolera basura sin explotar', () => {
    for (const input of [null, undefined, 0, 'nope', [], true]) {
      assert.deepEqual(mergeRecommendationsConfig(input), RECOMMENDATIONS_DEFAULTS);
    }
  });

  it('ignora claves desconocidas', () => {
    const merged = mergeRecommendationsConfig({ nope: 1, default_result_limit: 4 });
    assert.equal((merged as Record<string, unknown>).nope, undefined);
    assert.equal(merged.default_result_limit, 4);
  });

  it('clampea el result_limit y el candidate_limit a los topes duros', () => {
    const merged = mergeRecommendationsConfig({
      default_result_limit: 9999,
      default_candidate_limit: 9999,
    });
    assert.equal(merged.default_result_limit, RECOMMENDATIONS_HARD_CAPS.result_limit);
    assert.equal(merged.default_candidate_limit, RECOMMENDATIONS_HARD_CAPS.candidate_limit);
  });

  it('nunca deja candidate_limit por debajo del result_limit', () => {
    // Un candidate_limit menor al result_limit garantiza respuestas incompletas: no hay
    // margen para que los filtros operativos descarten nada (PRD §8).
    const merged = mergeRecommendationsConfig({ default_result_limit: 12, default_candidate_limit: 3 });
    assert.equal(merged.default_result_limit, 12);
    assert.ok(merged.default_candidate_limit >= merged.default_result_limit);
  });

  it('clampea el largo de la cadena de fallbacks', () => {
    assert.equal(
      mergeRecommendationsConfig({ max_chain_length: 99 }).max_chain_length,
      RECOMMENDATIONS_HARD_CAPS.max_chain_length,
    );
    assert.equal(mergeRecommendationsConfig({ max_chain_length: 0 }).max_chain_length, 1);
  });

  it('mantiene min_results dentro del limit efectivo', () => {
    const merged = mergeRecommendationsConfig({ default_result_limit: 4, min_results: 50 });
    assert.equal(merged.min_results, 4);
  });

  it('acepta números como string y redondea', () => {
    const merged = mergeRecommendationsConfig({ default_result_limit: '6', event_ttl_hours: '12.4' });
    assert.equal(merged.default_result_limit, 6);
    assert.equal(merged.event_ttl_hours, 12);
  });
});

describe('mergeRecommendationsConfig — envío gratis', () => {
  it('deja el threshold en null cuando no está seteado o es inválido', () => {
    for (const threshold of [undefined, null, '', 'abc', -5]) {
      assert.equal(mergeRecommendationsConfig({ free_shipping: { threshold } }).free_shipping.threshold, null);
    }
  });

  it('conserva el threshold informativo cuando es válido', () => {
    const fs = mergeRecommendationsConfig({ free_shipping: { threshold: 85_000 } }).free_shipping;
    assert.equal(fs.threshold, 85_000);
  });

  it('mantiene los mensajes por defecto ante strings vacíos', () => {
    const fs = mergeRecommendationsConfig({
      free_shipping: { message_in_progress: '   ', message_completed: '' },
    }).free_shipping;
    assert.equal(fs.message_in_progress, RECOMMENDATIONS_DEFAULTS.free_shipping.message_in_progress);
    assert.equal(fs.message_completed, RECOMMENDATIONS_DEFAULTS.free_shipping.message_completed);
    assert.ok(fs.message_in_progress.includes('{amount}'));
  });

  it('nunca deja la banda de bridge invertida', () => {
    // Una banda invertida (upper < lower) haría que el filtro de precio descarte
    // todos los candidatos en silencio.
    const fs = mergeRecommendationsConfig({
      free_shipping: { bridge_lower_factor: 0.9, bridge_upper_factor: 0.2 },
    }).free_shipping;
    assert.equal(fs.bridge_lower_factor, 0.9);
    assert.ok(fs.bridge_upper_factor >= fs.bridge_lower_factor);
  });

  it('respeta la banda asimétrica del ejemplo del PRD', () => {
    const fs = RECOMMENDATIONS_DEFAULTS.free_shipping;
    const missing = 8000;
    assert.equal(Math.round(missing * fs.bridge_lower_factor), 6000);
    assert.equal(Math.round(missing * fs.bridge_upper_factor), 12000);
  });
});

describe('mergeStrategyConfig', () => {
  it('nunca devuelve un valor parcial', () => {
    const merged = mergeStrategyConfig(undefined);
    assert.deepEqual(merged, STRATEGY_CONFIG_DEFAULTS);
    assert.deepEqual(
      Object.keys(merged.similarity_weights).sort(),
      Object.keys(STRATEGY_CONFIG_DEFAULTS.similarity_weights).sort(),
    );
  });

  it('arranca con los mínimos de evidencia del PRD §6', () => {
    assert.equal(STRATEGY_CONFIG_DEFAULTS.min_orders_analyzed, 50);
    assert.equal(STRATEGY_CONFIG_DEFAULTS.min_co_occurrences, 3);
  });

  it('clampea el tamaño de canasta al tope duro', () => {
    // El self-join de co-compra es O(Σ basket²): sin este tope una orden B2B de
    // 200 líneas aporta 40.000 pares por sí sola y clava el vCPU.
    assert.equal(
      mergeStrategyConfig({ max_basket_size: 100_000 }).max_basket_size,
      STRATEGY_HARD_CAPS.max_basket_size,
    );
    assert.equal(mergeStrategyConfig({ max_basket_size: 1 }).max_basket_size, 2);
  });

  it('clampea confianza y lookback', () => {
    assert.equal(mergeStrategyConfig({ min_confidence: 5 }).min_confidence, 1);
    assert.equal(mergeStrategyConfig({ min_confidence: -1 }).min_confidence, 0);
    assert.equal(
      mergeStrategyConfig({ lookback_days: 99_999 }).lookback_days,
      STRATEGY_HARD_CAPS.lookback_days,
    );
  });

  it('mergea los pesos de similitud campo por campo', () => {
    const merged = mergeStrategyConfig({ similarity_weights: { tags: 0.9 } });
    assert.equal(merged.similarity_weights.tags, 0.9);
    assert.equal(
      merged.similarity_weights.category,
      STRATEGY_CONFIG_DEFAULTS.similarity_weights.category,
    );
  });
});
