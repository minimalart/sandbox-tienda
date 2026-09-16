import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PriceListTarget } from './plan-price-updates.ts';
import {
  detectOverridingPriceLists,
  draftPriceListWarning,
  overridingPriceListWarning,
  type PriceListSnapshot,
} from './detect-overriding-price-lists.ts';

/** El caso real de desdeelsur, tal como lo devuelve `/admin/price-lists`. */
const ECOMMERCE: PriceListSnapshot = {
  id: 'plist_01M00J7K3DKEP0EMR4K9ZNYFX0',
  title: 'Ecommerce',
  status: 'active',
  type: 'override',
  rules: null,
};

const LISTA_WEB: PriceListSnapshot = {
  id: 'plist_01M1HA5CBW57FM2289REAT1CV0',
  title: 'LISTA WEB',
  status: 'draft',
  type: 'override',
  rules: null,
};

const MANAGED: PriceListTarget[] = [
  { zeus_index: 4, price_list_id: LISTA_WEB.id, title: 'LISTA WEB' },
];

describe('detectOverridingPriceLists', () => {
  it('detecta el caso real: override activa, sin reglas, ajena al ERP', () => {
    assert.deepEqual(
      detectOverridingPriceLists({
        priceLists: [ECOMMERCE, LISTA_WEB],
        managedTargets: MANAGED,
      }),
      [{ id: ECOMMERCE.id, title: 'Ecommerce' }]
    );
  });

  it('no avisa de las listas que el propio ERP administra', () => {
    assert.deepEqual(
      detectOverridingPriceLists({
        priceLists: [{ ...LISTA_WEB, status: 'active' }],
        managedTargets: MANAGED,
      }),
      []
    );
  });

  it('una draft no pisa nada: no aplica a ningún cliente', () => {
    assert.deepEqual(
      detectOverridingPriceLists({
        priceLists: [{ ...ECOMMERCE, status: 'draft' }],
        managedTargets: [],
      }),
      []
    );
  });

  it('una lista con customer group es una lista mayorista sana', () => {
    assert.deepEqual(
      detectOverridingPriceLists({
        priceLists: [{ ...ECOMMERCE, rules: { 'customer.groups.id': ['cusgroup_1'] } }],
        managedTargets: [],
      }),
      []
    );
  });

  it('un objeto de reglas vacío cuenta como SIN reglas', () => {
    assert.equal(
      detectOverridingPriceLists({
        priceLists: [{ ...ECOMMERCE, rules: {} }],
        managedTargets: [],
      }).length,
      1
    );
  });

  it('una price list de tipo sale es un descuento sobre el precio del ERP, no un techo', () => {
    assert.deepEqual(
      detectOverridingPriceLists({
        priceLists: [{ ...ECOMMERCE, type: 'sale' }],
        managedTargets: [],
      }),
      []
    );
  });

  it('sin título cae al id, para que el warning igual sea accionable', () => {
    assert.deepEqual(
      detectOverridingPriceLists({
        priceLists: [{ ...ECOMMERCE, title: '   ' }],
        managedTargets: [],
      }),
      [{ id: ECOMMERCE.id, title: ECOMMERCE.id }]
    );
  });
});

describe('overridingPriceListWarning', () => {
  it('sin listas no hay warning', () => {
    assert.equal(overridingPriceListWarning([]), null);
  });

  it('nombra la lista y dice qué hacer', () => {
    const warning = overridingPriceListWarning([{ id: 'plist_1', title: 'Ecommerce' }]);
    assert.ok(warning);
    assert.match(warning, /"Ecommerce"/);
    assert.match(warning, /draft|customer group/);
  });
});

describe('draftPriceListWarning', () => {
  it('avisa de la lista mapeada que quedó en draft', () => {
    const warning = draftPriceListWarning(MANAGED, new Map([[LISTA_WEB.id, 'draft']]));
    assert.ok(warning);
    assert.match(warning, /"LISTA WEB" \(lista 4\)/);
  });

  it('no avisa cuando la lista mapeada está activa', () => {
    assert.equal(draftPriceListWarning(MANAGED, new Map([[LISTA_WEB.id, 'active']])), null);
  });

  it('un estado desconocido no dispara el aviso', () => {
    assert.equal(draftPriceListWarning(MANAGED, new Map()), null);
  });
});
