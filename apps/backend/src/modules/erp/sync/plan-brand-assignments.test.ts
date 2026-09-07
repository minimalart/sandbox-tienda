import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planBrandAssignments } from './plan-brand-assignments.ts';

function run(
  rows: Array<{ code: string; brand: string | null }>,
  options: {
    products?: Array<[string, { product_id: string }]>;
    brands?: Array<[string, string]>;
    links?: Array<[string, Array<{ id: string; brand_id: string }>]>;
    replaceExisting?: boolean;
  } = {}
) {
  return planBrandAssignments({
    rows,
    productsByCode: new Map(options.products ?? rows.map((r) => [r.code, { product_id: `prod_${r.code}` }])),
    existingBrandIdByHandle: new Map(options.brands ?? []),
    existingLinksByProduct: new Map(options.links ?? []),
    ...(options.replaceExisting === undefined ? {} : { replaceExisting: options.replaceExisting }),
  });
}

describe('planBrandAssignments', () => {
  it('crea una marca por handle y linkea el producto', () => {
    const plan = run([
      { code: 'A1', brand: 'ALBA' },
      { code: 'A2', brand: 'EQ ARTE' },
      { code: 'A3', brand: 'ALBA' },
    ]);

    assert.deepEqual(plan.creates, [
      { name: 'ALBA', handle: 'alba' },
      { name: 'EQ ARTE', handle: 'eq-arte' },
    ]);
    assert.deepEqual([...plan.links], [
      ['alba', ['prod_A1', 'prod_A3']],
      ['eq-arte', ['prod_A2']],
    ]);
  });

  it('colapsa nombres que slugifican igual y elige el nombre determinísticamente', () => {
    const first = run([
      { code: 'A1', brand: 'Winsor  &  Newton' },
      { code: 'A2', brand: 'Winsor & Newton' },
    ]);
    const reversed = run([
      { code: 'A2', brand: 'Winsor & Newton' },
      { code: 'A1', brand: 'Winsor  &  Newton' },
    ]);

    assert.equal(first.creates.length, 1);
    assert.equal(first.creates[0]!.handle, 'winsor-newton');
    // Mismo catálogo en otro orden → misma marca creada.
    assert.deepEqual(first.creates, reversed.creates);
  });

  it('saca los diacríticos del handle', () => {
    const plan = run([{ code: 'A1', brand: 'Óleos Müller' }]);
    assert.equal(plan.creates[0]!.handle, 'oleos-muller');
  });

  it('no recrea una marca existente pero sí la linkea', () => {
    const plan = run([{ code: 'A1', brand: 'ALBA' }], { brands: [['alba', 'brand_1']] });
    assert.deepEqual(plan.creates, []);
    assert.deepEqual([...plan.links], [['alba', ['prod_A1']]]);
  });

  it('no escribe nada si el link ya existe', () => {
    const plan = run([{ code: 'A1', brand: 'ALBA' }], {
      brands: [['alba', 'brand_1']],
      links: [['prod_A1', [{ id: 'pbrnd_1', brand_id: 'brand_1' }]]],
    });

    assert.equal(plan.unchanged, 1);
    assert.equal(plan.links.size, 0);
    assert.deepEqual(plan.unlinkIds, []);
  });

  it('al cambiar de marca desliga la anterior', () => {
    const plan = run([{ code: 'A1', brand: 'REVEAR' }], {
      brands: [['alba', 'brand_1'], ['revear', 'brand_2']],
      links: [['prod_A1', [{ id: 'pbrnd_1', brand_id: 'brand_1' }]]],
    });

    assert.deepEqual([...plan.links], [['revear', ['prod_A1']]]);
    assert.deepEqual(plan.unlinkIds, ['pbrnd_1']);
  });

  it('con replaceExisting en false conserva las marcas previas', () => {
    const plan = run([{ code: 'A1', brand: 'REVEAR' }], {
      brands: [['alba', 'brand_1'], ['revear', 'brand_2']],
      links: [['prod_A1', [{ id: 'pbrnd_1', brand_id: 'brand_1' }]]],
      replaceExisting: false,
    });

    assert.deepEqual(plan.unlinkIds, []);
    assert.deepEqual([...plan.links], [['revear', ['prod_A1']]]);
  });

  it('artículo sin marca es un no-op', () => {
    const plan = run([
      { code: 'A1', brand: null },
      { code: 'A2', brand: '   ' },
    ]);

    assert.equal(plan.no_brand, 2);
    assert.deepEqual(plan.creates, []);
    assert.equal(plan.links.size, 0);
  });

  it('artículo sin producto en Medusa no genera link', () => {
    const plan = run([{ code: 'A1', brand: 'ALBA' }], { products: [] });
    assert.equal(plan.no_product, 1);
    assert.equal(plan.links.size, 0);
    // La marca igual se crea: existe en el ERP aunque el producto no esté todavía.
    assert.deepEqual(plan.creates, [{ name: 'ALBA', handle: 'alba' }]);
  });

  it('no duplica el mismo producto ni el mismo unlink cuando hay dos artículos', () => {
    const plan = run(
      [
        { code: 'A1', brand: 'REVEAR' },
        { code: 'A2', brand: 'REVEAR' },
      ],
      {
        products: [
          ['A1', { product_id: 'prod_1' }],
          ['A2', { product_id: 'prod_1' }],
        ],
        brands: [['revear', 'brand_2'], ['alba', 'brand_1']],
        links: [['prod_1', [{ id: 'pbrnd_1', brand_id: 'brand_1' }]]],
      }
    );

    assert.deepEqual([...plan.links], [['revear', ['prod_1']]]);
    assert.deepEqual(plan.unlinkIds, ['pbrnd_1']);
  });
});
