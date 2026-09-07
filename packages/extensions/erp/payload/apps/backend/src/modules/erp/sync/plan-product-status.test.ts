import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isErpOwnedVariant,
  planProductStatuses,
  type StatusCandidate,
} from './plan-product-status.ts';

const row = (code: string, active = true, published = true) => ({ code, active, published });

/** Producto creado por el sync: la variante lleva `source_product_id`. */
const owned = (
  product_id: string,
  status: string | null,
  code = 'X'
): StatusCandidate => ({
  product_id,
  status,
  metadata: { source: 'zeus', source_product_id: code },
});

const manual = (product_id: string, status: string | null): StatusCandidate => ({
  product_id,
  status,
  metadata: { brand: 'Alba' },
});

const map = (entries: Array<[string, StatusCandidate]>) => new Map(entries);

const base = { unpublishMissing: false, fullSweep: false };

describe('planProductStatuses — el ERP manda el estado en las dos direcciones', () => {
  it('publicable en el ERP + borrador en Medusa → publish', () => {
    const plan = planProductStatuses({
      ...base,
      rows: [row('010/50')],
      existing: map([['010/50', owned('prod_1', 'draft', '010/50')]]),
    });
    assert.deepEqual(plan.publish.map((c) => c.product_id), ['prod_1']);
    assert.equal(plan.publish[0].reason, 'erp_publishable');
    assert.equal(plan.unpublish.length, 0);
  });

  it('no publicable en el ERP + publicado en Medusa → unpublish', () => {
    for (const flags of [[false, true], [true, false], [false, false]] as const) {
      const plan = planProductStatuses({
        ...base,
        rows: [row('010/50', flags[0], flags[1])],
        existing: map([['010/50', owned('prod_1', 'published', '010/50')]]),
      });
      assert.deepEqual(plan.unpublish.map((c) => c.product_id), ['prod_1']);
      assert.equal(plan.unpublish[0].reason, 'erp_not_publishable');
    }
  });

  it('el estado ya coincide → unchanged, sin escrituras', () => {
    const plan = planProductStatuses({
      ...base,
      rows: [row('A'), row('B', false, false)],
      existing: map([
        ['A', owned('prod_a', 'published', 'A')],
        ['B', owned('prod_b', 'draft', 'B')],
      ]),
    });
    assert.equal(plan.publish.length, 0);
    assert.equal(plan.unpublish.length, 0);
    assert.equal(plan.unchanged, 2);
  });

  it('archived / rejected / proposed no se tocan en NINGUNA dirección', () => {
    for (const status of ['archived', 'rejected', 'proposed']) {
      const publishable = planProductStatuses({
        ...base,
        rows: [row('A')],
        existing: map([['A', owned('prod_a', status, 'A')]]),
      });
      assert.equal(publishable.publish.length, 0, `publish sobre ${status}`);
      assert.equal(publishable.skipped_manual_state, 1);

      const notPublishable = planProductStatuses({
        ...base,
        rows: [row('A', false, false)],
        existing: map([['A', owned('prod_a', status, 'A')]]),
      });
      assert.equal(notPublishable.unpublish.length, 0, `unpublish sobre ${status}`);
      assert.equal(notPublishable.skipped_manual_state, 1);
    }
  });

  it('producto que NO creó el sync no se toca, aunque comparta SKU', () => {
    const plan = planProductStatuses({
      ...base,
      rows: [row('A', false, false)],
      existing: map([['A', manual('prod_manual', 'published')]]),
    });
    assert.equal(plan.unpublish.length, 0);
    assert.equal(plan.skipped_not_owned, 1);
  });

  it('varios artículos en el mismo producto: uno publicable alcanza para NO despublicar', () => {
    // Dos presentaciones del mismo producto; se dio de baja una sola. Despublicar
    // sacaría de la tienda a la que sigue vendible.
    const product = owned('prod_1', 'published', '010/50');
    const plan = planProductStatuses({
      ...base,
      rows: [row('010/50', false, false), row('010/100')],
      existing: map([
        ['010/50', product],
        ['010/100', { ...product, metadata: { source_product_id: '010/100' } }],
      ]),
    });
    assert.equal(plan.unpublish.length, 0);
    assert.equal(plan.unchanged, 1);
  });

  it('varios artículos en el mismo producto, TODOS de baja → un solo unpublish', () => {
    const product = owned('prod_1', 'published', '010/50');
    const plan = planProductStatuses({
      ...base,
      rows: [row('010/50', false, false), row('010/100', false, false)],
      existing: map([
        ['010/50', product],
        ['010/100', { ...product, metadata: { source_product_id: '010/100' } }],
      ]),
    });
    assert.equal(plan.unpublish.length, 1);
    assert.deepEqual(plan.unpublish[0].codes, ['010/50', '010/100']);
  });

  it('ausente del ERP: en un DELTA no despublica nada', () => {
    // "No vino" en un delta significa "no cambió". Aplicarlo acá vaciaría la
    // tienda cada 15 minutos.
    const plan = planProductStatuses({
      rows: [row('A')],
      existing: map([['A', owned('prod_a', 'published', 'A')]]),
      erpOwned: map([
        ['A', owned('prod_a', 'published', 'A')],
        ['Z', owned('prod_z', 'published', 'Z')],
      ]),
      unpublishMissing: true,
      fullSweep: false,
    });
    assert.equal(plan.unpublish.length, 0);
  });

  it('ausente del ERP en un BARRIDO COMPLETO con el flag → unpublish', () => {
    const plan = planProductStatuses({
      rows: [row('A')],
      existing: map([['A', owned('prod_a', 'published', 'A')]]),
      erpOwned: map([
        ['A', owned('prod_a', 'published', 'A')],
        ['Z', owned('prod_z', 'published', 'Z')],
      ]),
      unpublishMissing: true,
      fullSweep: true,
    });
    assert.deepEqual(plan.unpublish.map((c) => c.product_id), ['prod_z']);
    assert.equal(plan.unpublish[0].reason, 'missing_in_full_sweep');
  });

  it('ausente del ERP con el flag APAGADO no despublica ni en barrido completo', () => {
    const plan = planProductStatuses({
      rows: [row('A')],
      existing: map([['A', owned('prod_a', 'published', 'A')]]),
      erpOwned: map([['Z', owned('prod_z', 'published', 'Z')]]),
      unpublishMissing: false,
      fullSweep: true,
    });
    assert.equal(plan.unpublish.length, 0);
  });

  it('ida y vuelta: draft → published → draft', () => {
    const publish = planProductStatuses({
      ...base,
      rows: [row('A')],
      existing: map([['A', owned('prod_a', 'draft', 'A')]]),
    });
    assert.equal(publish.publish.length, 1);

    const unpublish = planProductStatuses({
      ...base,
      rows: [row('A', true, false)],
      existing: map([['A', owned('prod_a', 'published', 'A')]]),
    });
    assert.equal(unpublish.unpublish.length, 1);
  });

  it('artículo del ERP sin producto en Medusa se ignora (lo crea el alta, no esta fase)', () => {
    const plan = planProductStatuses({ ...base, rows: [row('NUEVO')], existing: map([]) });
    assert.deepEqual(plan, {
      publish: [],
      unpublish: [],
      unchanged: 0,
      skipped_not_owned: 0,
      skipped_manual_state: 0,
    });
  });
});

describe('isErpOwnedVariant', () => {
  it('reconoce lo que escribe el sync y rechaza el resto', () => {
    assert.equal(isErpOwnedVariant({ source_product_id: '010/50' }), true);
    assert.equal(isErpOwnedVariant({ source: 'zeus' }), true);
    assert.equal(isErpOwnedVariant({ source: 'vtex' }), false);
    assert.equal(isErpOwnedVariant({ source_product_id: '   ' }), false);
    assert.equal(isErpOwnedVariant({ brand: 'Alba' }), false);
    assert.equal(isErpOwnedVariant(null), false);
  });
});
