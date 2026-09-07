import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RECOMMENDATIONS_DEFAULTS, RECOMMENDATIONS_HARD_CAPS } from '../config';
import { buildChain } from '../serve/resolve';
import { DEFAULT_PLACEMENTS, DEFAULT_STRATEGIES } from './defaults';

/**
 * Estos tests cruzan los datos sembrados contra la config REAL por defecto.
 *
 * Existen por un defecto que se escapó a producción: `max_chain_length` valía 3, las
 * cadenas sembradas más largas tienen 4 tiers, y `buildChain` recortaba el terminal
 * `popular` en 3 de los 6 placements — justamente en los que arrancan en `manual` o
 * `frequently_bought_together`, que son los que están vacíos el día 1. O sea que la
 * garantía de "una tienda nueva igual ve recomendaciones" se rompía en silencio,
 * exactamente donde más importaba.
 *
 * Ni los tests de `mergeRecommendationsConfig` ni los de `buildChain` lo cazaron: cada
 * pieza estaba bien por separado. El defecto vivía en la INTERACCIÓN entre el largo de
 * las cadenas sembradas y el tope de la config, y sólo se ve mirando las dos juntas.
 */

// `buildChain` sólo necesita `enabled` y `fallback_chain` de cada estrategia.
const strategyMap = new Map(
  DEFAULT_STRATEGIES.map((strategy) => [
    strategy.key,
    { enabled: true, fallback_chain: strategy.fallback_chain } as never,
  ]),
);

const effectiveChainOf = (placementKey: string, maxLength: number): string[] => {
  const placement = DEFAULT_PLACEMENTS.find((entry) => entry.key === placementKey);
  assert.ok(placement, `placement ${placementKey} no existe en los defaults`);
  return buildChain(
    { strategy_key: placement.strategy_key, fallback_chain: placement.fallback_chain ?? null },
    strategyMap,
    maxLength,
  );
};

describe('seeds por defecto — cadenas de fallback', () => {
  it('TODA cadena efectiva termina en `popular` con la config por defecto', () => {
    // La invariante que importa: `popular` es el único terminal que puede responder sin
    // órdenes ni relaciones manuales cargadas.
    for (const placement of DEFAULT_PLACEMENTS) {
      const chain = effectiveChainOf(placement.key, RECOMMENDATIONS_DEFAULTS.max_chain_length);
      assert.ok(
        chain.includes('popular'),
        `el placement ${placement.key} no alcanza \`popular\`: [${chain.join(' → ')}]`,
      );
    }
  });

  it('ninguna cadena sembrada excede el hard cap', () => {
    // Si una cadena necesitara más tiers que el tope duro, sería imposible de satisfacer
    // por configuración: habría que subir el cap o acortar la cadena.
    for (const placement of DEFAULT_PLACEMENTS) {
      const chain = effectiveChainOf(placement.key, RECOMMENDATIONS_HARD_CAPS.max_chain_length);
      assert.ok(
        chain.includes('popular'),
        `${placement.key} no alcanza \`popular\` ni con el hard cap (${RECOMMENDATIONS_HARD_CAPS.max_chain_length})`,
      );
    }
  });

  it('el default no supera el hard cap', () => {
    assert.ok(
      RECOMMENDATIONS_DEFAULTS.max_chain_length <= RECOMMENDATIONS_HARD_CAPS.max_chain_length,
      'el default de max_chain_length no puede exceder el hard cap',
    );
  });

  it('documenta el defecto: con max_chain_length=3 se pierde `popular`', () => {
    // Regresión explícita. Si alguien baja el default a 3, el primer test falla; este
    // deja constancia de POR QUÉ, para que no se "arregle" bajando el tope.
    const truncated = effectiveChainOf('product-detail-complementary', 3);
    assert.equal(truncated.includes('popular'), false);
    assert.deepEqual(truncated, ['manual', 'frequently_bought_together', 'similar']);
  });

  it('`popular` es terminal: no tiene fallback', () => {
    const popular = DEFAULT_STRATEGIES.find((strategy) => strategy.key === 'popular');
    assert.deepEqual(popular?.fallback_chain, []);
  });

  it('toda estrategia referenciada por un placement existe', () => {
    const keys = new Set(DEFAULT_STRATEGIES.map((strategy) => strategy.key));
    for (const placement of DEFAULT_PLACEMENTS) {
      assert.ok(keys.has(placement.strategy_key), `${placement.key} → ${placement.strategy_key}`);
      for (const key of placement.fallback_chain ?? []) {
        assert.ok(keys.has(key), `${placement.key} tiene un fallback inexistente: ${key}`);
      }
    }
  });

  it('toda estrategia referenciada en una cadena de estrategia existe', () => {
    const keys = new Set(DEFAULT_STRATEGIES.map((strategy) => strategy.key));
    for (const strategy of DEFAULT_STRATEGIES) {
      for (const key of strategy.fallback_chain) {
        assert.ok(keys.has(key), `${strategy.key} tiene un fallback inexistente: ${key}`);
      }
    }
  });

  it('las keys sembradas son únicas', () => {
    assert.equal(new Set(DEFAULT_STRATEGIES.map((s) => s.key)).size, DEFAULT_STRATEGIES.length);
    assert.equal(new Set(DEFAULT_PLACEMENTS.map((p) => p.key)).size, DEFAULT_PLACEMENTS.length);
  });

  it('los 6 placements del PRD están sembrados', () => {
    assert.deepEqual(DEFAULT_PLACEMENTS.map((p) => p.key).sort(), [
      'cart-recommendations',
      'free-shipping-bridge',
      'product-detail-complementary',
      'product-detail-fbt',
      'product-detail-similar',
      'recently-viewed',
    ]);
  });
});
