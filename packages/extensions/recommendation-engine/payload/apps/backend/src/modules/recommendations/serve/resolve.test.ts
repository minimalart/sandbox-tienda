import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildChain } from './resolve';

type StrategyRow = Parameters<typeof buildChain>[1] extends Map<string, infer T> ? T : never;

const strategy = (key: string, overrides: Partial<StrategyRow> = {}): StrategyRow =>
  ({
    key,
    kind: 'similar',
    enabled: true,
    fallback_chain: null,
    config: null,
    sales_channel_id: null,
    ...overrides,
  }) as StrategyRow;

const registry = (...rows: StrategyRow[]) => new Map(rows.map((row) => [row.key, row]));

const ALL = registry(
  strategy('manual', { kind: 'manual' }),
  strategy('similar'),
  strategy('frequently_bought_together', { kind: 'frequently_bought_together' }),
  strategy('trending', { kind: 'trending' }),
  strategy('popular', { kind: 'popular' }),
);

describe('buildChain', () => {
  it('arranca siempre por la estrategia del placement', () => {
    const chain = buildChain({ strategy_key: 'similar', fallback_chain: ['popular'] }, ALL, 3);
    assert.deepEqual(chain, ['similar', 'popular']);
  });

  it('el override del placement gana sobre la cadena de la estrategia', () => {
    const strategies = registry(
      strategy('similar', { fallback_chain: ['trending'] }),
      strategy('popular', { kind: 'popular' }),
      strategy('trending', { kind: 'trending' }),
    );
    const chain = buildChain({ strategy_key: 'similar', fallback_chain: ['popular'] }, strategies, 3);
    assert.deepEqual(chain, ['similar', 'popular']);
  });

  it('usa la cadena de la estrategia cuando el placement no define override', () => {
    const strategies = registry(
      strategy('similar', { fallback_chain: ['popular'] }),
      strategy('popular', { kind: 'popular' }),
    );
    assert.deepEqual(buildChain({ strategy_key: 'similar', fallback_chain: null }, strategies, 3), [
      'similar',
      'popular',
    ]);
  });

  it('trata una cadena vacía como ausente', () => {
    const strategies = registry(
      strategy('similar', { fallback_chain: ['popular'] }),
      strategy('popular', { kind: 'popular' }),
    );
    assert.deepEqual(buildChain({ strategy_key: 'similar', fallback_chain: [] }, strategies, 3), [
      'similar',
      'popular',
    ]);
  });

  it('deduplica', () => {
    // Repetir una estrategia haría el mismo trabajo dos veces y gastaría un eslabón
    // del presupuesto.
    const chain = buildChain(
      { strategy_key: 'similar', fallback_chain: ['similar', 'popular', 'popular'] },
      ALL,
      4,
    );
    assert.deepEqual(chain, ['similar', 'popular']);
  });

  it('recorta a max_chain_length', () => {
    const chain = buildChain(
      { strategy_key: 'frequently_bought_together', fallback_chain: ['manual', 'similar', 'popular'] },
      ALL,
      2,
    );
    assert.deepEqual(chain, ['frequently_bought_together', 'manual']);
  });

  it('saltea estrategias deshabilitadas', () => {
    const strategies = registry(
      strategy('similar'),
      strategy('trending', { kind: 'trending', enabled: false }),
      strategy('popular', { kind: 'popular' }),
    );
    const chain = buildChain(
      { strategy_key: 'similar', fallback_chain: ['trending', 'popular'] },
      strategies,
      4,
    );
    assert.deepEqual(chain, ['similar', 'popular']);
  });

  it('saltea estrategias inexistentes', () => {
    const chain = buildChain(
      { strategy_key: 'similar', fallback_chain: ['no_existe', 'popular'] },
      ALL,
      4,
    );
    assert.deepEqual(chain, ['similar', 'popular']);
  });

  it('devuelve vacío si la estrategia del placement está deshabilitada y no hay fallback', () => {
    const strategies = registry(strategy('similar', { enabled: false }));
    assert.deepEqual(buildChain({ strategy_key: 'similar', fallback_chain: null }, strategies, 3), []);
  });

  it('sigue con el fallback aunque la estrategia principal esté deshabilitada', () => {
    // Apagar una estrategia desde el backoffice no puede apagar el placement entero.
    const strategies = registry(
      strategy('frequently_bought_together', { kind: 'frequently_bought_together', enabled: false }),
      strategy('popular', { kind: 'popular' }),
    );
    const chain = buildChain(
      { strategy_key: 'frequently_bought_together', fallback_chain: ['popular'] },
      strategies,
      3,
    );
    assert.deepEqual(chain, ['popular']);
  });

  it('ignora entradas basura en la cadena', () => {
    const chain = buildChain(
      { strategy_key: 'similar', fallback_chain: [null, 42, '', 'popular'] as never },
      ALL,
      4,
    );
    assert.deepEqual(chain, ['similar', 'popular']);
  });

  it('devuelve vacío con un registro de estrategias vacío', () => {
    assert.deepEqual(
      buildChain({ strategy_key: 'similar', fallback_chain: ['popular'] }, new Map(), 3),
      [],
    );
  });

  it('la cadena sembrada de comprados juntos resuelve al orden del PRD §7', () => {
    const chain = buildChain(
      {
        strategy_key: 'frequently_bought_together',
        fallback_chain: ['manual', 'similar', 'popular'],
      },
      ALL,
      3,
    );
    assert.deepEqual(chain, ['frequently_bought_together', 'manual', 'similar']);
  });
});
