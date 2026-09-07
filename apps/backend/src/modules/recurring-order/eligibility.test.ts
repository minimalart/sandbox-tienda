import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isProductEligible,
  normalizeSetting,
  type RecurringEligibilityConfig,
} from './eligibility.ts';

const SELECTED: RecurringEligibilityConfig = {
  scope: 'selected',
  category_ids: ['cat_lacteos'],
  tag_values: ['Recurrente'],
  product_ids: ['prod_cafe'],
};

describe('isProductEligible', () => {
  it('scope all: todo elegible, sin mirar criterios', () => {
    assert.equal(
      isProductEligible(
        { scope: 'all', category_ids: [], tag_values: [], product_ids: [] },
        { id: 'prod_x' },
      ),
      true,
    );
  });

  it('selected: matchea por id puntual', () => {
    assert.equal(isProductEligible(SELECTED, { id: 'prod_cafe' }), true);
    assert.equal(isProductEligible(SELECTED, { id: 'prod_otro' }), false);
  });

  it('selected: matchea por categoría (alguna alcanza)', () => {
    assert.equal(
      isProductEligible(SELECTED, {
        id: 'prod_leche',
        category_ids: ['cat_bebidas', 'cat_lacteos'],
      }),
      true,
    );
    assert.equal(
      isProductEligible(SELECTED, { id: 'prod_pan', category_ids: ['cat_panaderia'] }),
      false,
    );
  });

  it('selected: matchea por tag case-insensitive', () => {
    assert.equal(
      isProductEligible(SELECTED, { id: 'prod_yerba', tag_values: ['recurrente'] }),
      true,
    );
    assert.equal(
      isProductEligible(SELECTED, { id: 'prod_yerba', tag_values: ['oferta'] }),
      false,
    );
  });

  it('selected sin criterios: nada elegible', () => {
    assert.equal(
      isProductEligible(
        { scope: 'selected', category_ids: [], tag_values: [], product_ids: [] },
        { id: 'prod_x', category_ids: ['cat_y'], tag_values: ['z'] },
      ),
      false,
    );
  });
});

describe('normalizeSetting', () => {
  it('fila ausente o scope inválido → all', () => {
    assert.equal(normalizeSetting(null).scope, 'all');
    assert.equal(normalizeSetting({ scope: 'whatever' }).scope, 'all');
  });

  it('sanea los arrays json (descarta no-strings y no-arrays)', () => {
    const config = normalizeSetting({
      scope: 'selected',
      category_ids: ['cat_1', 42, null],
      tag_values: 'no-es-array',
      product_ids: undefined,
    });
    assert.deepEqual(config.category_ids, ['cat_1']);
    assert.deepEqual(config.tag_values, []);
    assert.deepEqual(config.product_ids, []);
  });
});
