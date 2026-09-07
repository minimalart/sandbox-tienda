import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countSellableBases, type SellableVariantRow } from './sellable-bases.ts';

/**
 * `graph` de mentira: devuelve las variantes cuyo sku esté en el filtro y anota
 * cada llamada, para poder afirmar también CÓMO se consultó (que no se pida de
 * más, y que se parta en tandas cuando hay muchas bases).
 */
const graphOf = (variants: SellableVariantRow[]) => {
  const calls: string[][] = [];
  const fn = async (config: { filters?: Record<string, unknown> }) => {
    const wanted = (config.filters?.sku ?? []) as string[];
    calls.push(wanted);
    return { data: variants.filter((v) => wanted.includes(v.sku ?? '')) };
  };
  return { fn, calls };
};

describe('countSellableBases', () => {
  it('sin códigos no consulta nada', async () => {
    const { fn, calls } = graphOf([]);
    assert.equal(await countSellableBases(fn, []), 0);
    assert.equal(calls.length, 0);
  });

  it('cuenta la base que tiene variante de producto publicado', async () => {
    const { fn } = graphOf([{ sku: '113', product: { status: 'published' } }]);
    assert.equal(await countSellableBases(fn, ['113']), 1);
  });

  it('NO cuenta la base cuyo producto está en borrador', async () => {
    const { fn } = graphOf([{ sku: '113', product: { status: 'draft' } }]);
    assert.equal(await countSellableBases(fn, ['113']), 0);
  });

  /**
   * El caso de desdeelsur: 117 bases confirmadas, ningún artículo en Medusa.
   * Es el que hacía que `ready` dijera `true` con el tintométrico muerto.
   */
  it('da 0 cuando ninguna base existe como producto', async () => {
    const { fn } = graphOf([{ sku: '999', product: { status: 'published' } }]);
    assert.equal(await countSellableBases(fn, ['113', '114', '119']), 0);
  });

  /**
   * Sin estado conocido se cuenta, igual que en `loadVariantsBySku`: si los dos
   * criterios no coincidieran, el readiness diría que hay bases vendibles y la
   * página seguiría vacía.
   */
  it('cuenta la variante sin estado de producto', async () => {
    const { fn } = graphOf([{ sku: '113' }]);
    assert.equal(await countSellableBases(fn, ['113']), 1);
  });

  it('no cuenta dos veces la misma base ni pide códigos repetidos', async () => {
    const { fn, calls } = graphOf([
      { sku: '113', product: { status: 'published' } },
      { sku: '113', product: { status: 'published' } },
    ]);
    assert.equal(await countSellableBases(fn, ['113', ' 113 ', '']), 1);
    assert.deepEqual(calls, [['113']]);
  });

  it('parte en tandas cuando hay más bases que el tope por consulta', async () => {
    const codes = Array.from({ length: 501 }, (_, i) => `sku_${i}`);
    const { fn, calls } = graphOf(
      codes.map((sku) => ({ sku, product: { status: 'published' } }))
    );
    assert.equal(await countSellableBases(fn, codes), 501);
    assert.deepEqual(
      calls.map((c) => c.length),
      [500, 1]
    );
  });
});
