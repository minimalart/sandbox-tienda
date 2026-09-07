import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planCategoryAssignments, type ProductCategoryState } from './plan-category-assignments.ts';

const CATEGORY_BY_CODE = new Map([
  ['020B', 'pcat_artistica'],
  ['0A', 'pcat_complementos'],
]);
const ERP_OWNED = new Set(['pcat_artistica', 'pcat_complementos', 'pcat_vieja']);

function state(productId: string, categoryIds: string[] = []): ProductCategoryState {
  return { product_id: productId, category_ids: categoryIds };
}

function run(
  rows: Array<{ code: string; category_code: string | null }>,
  products: Array<[string, ProductCategoryState]>
) {
  return planCategoryAssignments({
    rows,
    productsByCode: new Map(products),
    categoryIdByCode: CATEGORY_BY_CODE,
    erpOwnedCategoryIds: ERP_OWNED,
  });
}

describe('planCategoryAssignments', () => {
  it('linkea un producto sin categoría', () => {
    const plan = run([{ code: 'A1', category_code: '020B' }], [['A1', state('prod_1')]]);

    assert.deepEqual([...plan.add], [['pcat_artistica', ['prod_1']]]);
    assert.equal(plan.remove.size, 0);
    assert.deepEqual([...plan.touched_product_ids], ['prod_1']);
    assert.deepEqual(plan.perArticle.get('A1'), {
      status: 'linked',
      code: '020B',
      category_id: 'pcat_artistica',
    });
  });

  it('no escribe nada si el producto ya está donde tiene que estar', () => {
    const plan = run(
      [{ code: 'A1', category_code: '020B' }],
      [['A1', state('prod_1', ['pcat_artistica'])]]
    );

    assert.equal(plan.add.size, 0);
    assert.equal(plan.remove.size, 0);
    assert.equal(plan.unchanged, 1);
    assert.equal(plan.touched_product_ids.size, 0);
  });

  it('al cambiar de nodo agrega el nuevo y saca el viejo', () => {
    const plan = run(
      [{ code: 'A1', category_code: '0A' }],
      [['A1', state('prod_1', ['pcat_artistica'])]]
    );

    assert.deepEqual([...plan.add], [['pcat_complementos', ['prod_1']]]);
    assert.deepEqual([...plan.remove], [['pcat_artistica', ['prod_1']]]);
  });

  it('NUNCA saca una categoría puesta a mano', () => {
    const plan = run(
      [{ code: 'A1', category_code: '0A' }],
      [['A1', state('prod_1', ['pcat_manual', 'pcat_artistica'])]]
    );

    assert.deepEqual([...plan.remove], [['pcat_artistica', ['prod_1']]]);
    assert.equal(plan.remove.has('pcat_manual'), false);
  });

  it('respeta la categoría manual cuando el producto ya está en la del ERP', () => {
    const plan = run(
      [{ code: 'A1', category_code: '020B' }],
      [['A1', state('prod_1', ['pcat_manual', 'pcat_artistica'])]]
    );

    assert.equal(plan.unchanged, 1);
    assert.equal(plan.add.size, 0);
    assert.equal(plan.remove.size, 0);
  });

  it('normaliza el código del artículo a mayúsculas', () => {
    const plan = run([{ code: 'A1', category_code: '020b' }], [['A1', state('prod_1')]]);
    assert.deepEqual([...plan.add], [['pcat_artistica', ['prod_1']]]);
  });

  it('artículo sin categoría en el ERP es un no-op (no descategoriza)', () => {
    const plan = run(
      [{ code: 'A1', category_code: null }],
      [['A1', state('prod_1', ['pcat_artistica'])]]
    );

    assert.equal(plan.no_category, 1);
    assert.equal(plan.add.size, 0);
    assert.equal(plan.remove.size, 0);
    assert.deepEqual(plan.perArticle.get('A1'), { status: 'no_category', code: null });
  });

  it('cuenta los códigos que el árbol no cubre', () => {
    const plan = run(
      [
        { code: 'A1', category_code: 'ZZ' },
        { code: 'A2', category_code: 'ZZ' },
      ],
      [
        ['A1', state('prod_1')],
        ['A2', state('prod_2')],
      ]
    );

    assert.deepEqual([...plan.unknown_codes], [['ZZ', 2]]);
    assert.equal(plan.add.size, 0);
  });

  it('artículo sin producto en Medusa no rompe la corrida', () => {
    const plan = run([{ code: 'A1', category_code: '020B' }], []);
    assert.equal(plan.no_product, 1);
    assert.equal(plan.add.size, 0);
  });

  it('agrupa varios productos por categoría destino', () => {
    const plan = run(
      [
        { code: 'A1', category_code: '020B' },
        { code: 'A2', category_code: '020B' },
      ],
      [
        ['A1', state('prod_1')],
        ['A2', state('prod_2')],
      ]
    );

    assert.deepEqual([...plan.add], [['pcat_artistica', ['prod_1', 'prod_2']]]);
  });
});
