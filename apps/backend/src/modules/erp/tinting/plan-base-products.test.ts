import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { baseHandleSeed, formulaKeyOf, planBaseProducts } from './plan-base-products.ts';
import { resolveTitleRules } from '../sync/product-title.ts';
import type { ErpCatalogRow } from '../adapters/types.ts';

/** Las reglas de default, que son las que corren en producción. */
const RULES = resolveTitleRules(null);

const row = (over: Partial<ErpCatalogRow> = {}): ErpCatalogRow =>
  ({
    code: '113',
    title: 'ALBACRYL LATEX INTERIOR ACRILICO MATE BASE F X 3,6 LTS',
    description: null,
    prices: { 1: 40585.52 },
    active: true,
    published: true,
    category_code: '0209',
    weight: null,
    ...over,
  }) as ErpCatalogRow;

const ALBACRYL_F = formulaKeyOf('ALBACRYL LATEX INTERIOR ACRILICO MATE', 'F');

describe('planBaseProducts', () => {
  it('crea la base y la publica cuando su línea+letra ya tiene colores', () => {
    const plan = planBaseProducts({
      rows: [row()],
      existingSkus: new Set(),
      formulaKeys: new Set([ALBACRYL_F]),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.equal(plan.creates.length, 1);
    assert.equal(plan.publishable, 1);
    assert.deepEqual(
      {
        sku: plan.creates[0]!.sku,
        status: plan.creates[0]!.status,
        price: plan.creates[0]!.price,
        letter: plan.creates[0]!.base_letter,
        size: plan.creates[0]!.size_label,
      },
      { sku: '113', status: 'published', price: 40585.52, letter: 'F', size: '3,6 LTS' }
    );
  });

  it('sin colores validados la crea en BORRADOR (una base sin carta no se vende)', () => {
    const plan = planBaseProducts({
      rows: [row()],
      existingSkus: new Set(),
      formulaKeys: new Set(),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.equal(plan.creates[0]?.status, 'draft');
    assert.equal(plan.publishable, 0);
  });

  it('descarta lo que no es base: es lo que evita meter los 618 artículos con el mismo flag', () => {
    const plan = planBaseProducts({
      rows: [
        row({ code: '1000', title: 'Descuento' }),
        row({ code: '000001', title: 'MODIFICA DESCRIPCIÓN' }),
        row({ code: '101/5', title: 'EL GALGO - PINCEL 101 N5' }),
        row({ code: '100/200B', title: 'EQ ARTE - BASE ACRILICA 100 NEGRO X 200 CC' }),
      ],
      existingSkus: new Set(),
      formulaKeys: new Set(),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.equal(plan.creates.length, 0);
    assert.deepEqual(
      plan.skips.map((s) => s.reason),
      ['not_a_base', 'not_a_base', 'not_a_base', 'not_a_base']
    );
  });

  it('no recrea lo que ya está en Medusa', () => {
    const plan = planBaseProducts({
      rows: [row()],
      existingSkus: new Set(['113']),
      formulaKeys: new Set([ALBACRYL_F]),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.skips[0]?.reason, 'already_in_medusa');
  });

  it('sin precio en la lista base no crea nada (dejaría una ficha rota)', () => {
    for (const prices of [{ 1: 0 }, {}, { 4: 100 }]) {
      const plan = planBaseProducts({
        rows: [row({ prices: prices as Record<number, number> })],
        existingSkus: new Set(),
        formulaKeys: new Set(),
        baseListIndex: 1,
        titleRules: RULES,
      });
      assert.equal(plan.creates.length, 0);
      assert.equal(plan.skips[0]?.reason, 'no_price');
    }
  });

  it('respeta el índice de lista configurado', () => {
    const plan = planBaseProducts({
      rows: [row({ prices: { 1: 40585.52, 4: 28409.87 } })],
      existingSkus: new Set(),
      formulaKeys: new Set(),
      baseListIndex: 4,
      titleRules: RULES,
    });
    assert.equal(plan.creates[0]?.price, 28409.87);
  });

  it('saltea inactivos', () => {
    const plan = planBaseProducts({
      rows: [row({ active: false })],
      existingSkus: new Set(),
      formulaKeys: new Set(),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.equal(plan.skips[0]?.reason, 'inactive');
  });

  it('la letra nula (base única) tiene su propia clave de fórmulas', () => {
    const unica = row({
      code: '712',
      title: 'ALBA EFECTOS ESPECIALES DESIGN MARMOL BASE X 3,24 LTS',
    });
    const key = formulaKeyOf('ALBA EFECTOS ESPECIALES DESIGN MARMOL', null);
    const plan = planBaseProducts({
      rows: [unica],
      existingSkus: new Set(),
      formulaKeys: new Set([key]),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.equal(plan.creates[0]?.base_letter, null);
    assert.equal(plan.creates[0]?.status, 'published');
  });

  it('el título va normalizado y el crudo queda aparte (DESDEELSUR-13)', () => {
    // El caso del ticket: la base entraba con el título literal de Zeus y el
    // listado mezclaba MAYÚSCULAS con nombres ya normalizados.
    const plan = planBaseProducts({
      rows: [
        row({
          code: '5001',
          title: 'REVEAR - MARBLE COLOR BASE T X 3,6 LTS',
          brand: 'REVEAR',
        } as Partial<ErpCatalogRow>),
      ],
      existingSkus: new Set(),
      formulaKeys: new Set(),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.deepEqual(
      { title: plan.creates[0]?.title, source: plan.creates[0]?.source_title },
      {
        // R16 saca el guión, R25 redondea el envase (3,6 → 4 lt) y R26 se lleva
        // la letra de base: en la tienda se elige el color, la base sale sola.
        title: 'Marble color x4 lt',
        source: 'REVEAR - MARBLE COLOR BASE T X 3,6 LTS',
      }
    );
  });

  it('con la normalización apagada el título queda literal (comportamiento histórico)', () => {
    const plan = planBaseProducts({
      rows: [row()],
      existingSkus: new Set(),
      formulaKeys: new Set(),
      baseListIndex: 1,
      titleRules: null,
    });
    assert.equal(
      plan.creates[0]?.title,
      'ALBACRYL LATEX INTERIOR ACRILICO MATE BASE F X 3,6 LTS'
    );
  });

  it('los descartes reportan el título CRUDO (es lo que se cruza contra Zeus)', () => {
    const plan = planBaseProducts({
      rows: [row({ code: '1000', title: 'REVEAR - MODIFICA DESCRIPCIÓN' })],
      existingSkus: new Set(),
      formulaKeys: new Set(),
      baseListIndex: 1,
      titleRules: RULES,
    });
    assert.equal(plan.skips[0]?.title, 'REVEAR - MODIFICA DESCRIPCIÓN');
  });
});

describe('baseHandleSeed', () => {
  it('saca tildes y símbolos, y termina con el SKU para no colisionar entre tamaños', () => {
    assert.equal(
      baseHandleSeed('ALBACRYL LATEX INTERIOR ACRILICO MATE BASE F X 3,6 LTS', '113'),
      'albacryl-latex-interior-acrilico-mate-base-f-x-3-6-lts-113'
    );
    // Las tildes se van de verdad (el punto del test del regex de marcas).
    assert.equal(baseHandleSeed('PINTURA ACRÍLICA ÚNICA BASE Ñ', '9'), 'pintura-acrilica-unica-base-n-9');
  });

  it('cae al SKU si el título no deja nada usable', () => {
    assert.equal(baseHandleSeed('///', 'AK20'), 'ak20');
  });
});
