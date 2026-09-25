import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { availableAt, buildLocationCoverage, pendingOf, type StockLine } from './stock-by-location.ts';

/**
 * "Que vea de dónde tiene stock" (DESDEELSUR-61).
 *
 * El gate exige cubrir la orden COMPLETA desde UNA ubicación, así que la
 * pregunta útil no es "cuánto hay" sino "quién puede despachar todo". Estos
 * tests atan esa cuenta.
 */
const ELFLEIN = 'sloc_elflein';
const MELIPAL = 'sloc_melipal';

const sucursales = [
  { stock_location_id: ELFLEIN, stock_location_name: 'Elflein', deposito: '1' },
  { stock_location_id: MELIPAL, stock_location_name: 'Melipal', deposito: '2' },
];

const linea = (over: Partial<StockLine> & Pick<StockLine, 'item_id'>): StockLine => ({
  title: over.item_id,
  sku: null,
  pending: 1,
  available: {},
  ...over,
});

describe('pendingOf', () => {
  it('es la MISMA cuenta que usa el gate', () => {
    // Si divergiera, esta pantalla pintaría una sucursal en verde que el gate
    // después rechaza. Por eso reexporta `pendingQuantity` en vez de recalcular.
    assert.equal(pendingOf({ id: 'i', detail: { quantity: 5, fulfilled_quantity: 2 } }), 3);
    assert.equal(pendingOf({ id: 'i', quantity: 4, detail: null }), 4);
    // Sobre-despachado: no puede devolver negativo.
    assert.equal(pendingOf({ id: 'i', detail: { quantity: 2, fulfilled_quantity: 5 } }), 0);
  });
});

describe('availableAt', () => {
  it('una ubicación sin el artículo es 0, no undefined', () => {
    const line = linea({ item_id: 'i1', available: { [MELIPAL]: 3 } });
    assert.equal(availableAt(line, MELIPAL), 3);
    assert.equal(availableAt(line, ELFLEIN), 0);
  });

  it('un disponible negativo se lee como 0', () => {
    const line = linea({ item_id: 'i1', available: { [MELIPAL]: -4 } });
    assert.equal(availableAt(line, MELIPAL), 0);
  });
});

describe('buildLocationCoverage', () => {
  it('marca la sucursal que puede despachar TODO y la pone primera', () => {
    const lines = [
      linea({ item_id: 'i1', title: 'Látex 20L', pending: 2, available: { [ELFLEIN]: 1, [MELIPAL]: 5 } }),
      linea({ item_id: 'i2', title: 'Rodillo', pending: 1, available: { [ELFLEIN]: 9, [MELIPAL]: 3 } }),
    ];
    const coverage = buildLocationCoverage(lines, sucursales);

    assert.equal(coverage[0].stock_location_id, MELIPAL);
    assert.equal(coverage[0].covers_all, true);
    assert.deepEqual(coverage[0].gaps, []);

    // Elflein cubre el rodillo pero no el látex: NO sirve, y hay que decir por qué.
    assert.equal(coverage[1].covers_all, false);
    assert.equal(coverage[1].covered_lines, 1);
    assert.deepEqual(coverage[1].gaps, [
      { item_id: 'i1', title: 'Látex 20L', pending: 2, available: 1 },
    ]);
  });

  it('el stock justo alcanza: cubrir es >=, no >', () => {
    const lines = [linea({ item_id: 'i1', pending: 3, available: { [MELIPAL]: 3 } })];
    const melipal = buildLocationCoverage(lines, sucursales).find((c) => c.stock_location_id === MELIPAL);
    assert.equal(melipal?.covers_all, true);
  });

  it('una línea ya despachada no cuenta ni como cobertura ni como faltante', () => {
    const lines = [
      linea({ item_id: 'i1', pending: 0, available: {} }),
      linea({ item_id: 'i2', pending: 1, available: { [ELFLEIN]: 4 } }),
    ];
    const elflein = buildLocationCoverage(lines, sucursales).find((c) => c.stock_location_id === ELFLEIN);
    assert.equal(elflein?.covers_all, true);
    assert.equal(elflein?.covered_lines, 1, 'la línea en 0 no suma');
  });

  it('un pedido sin nada pendiente no lo cubre nadie', () => {
    // No es "todas pueden": es que no hay nada que despachar. Pintarlas todas en
    // verde invitaría a crear un fulfillment vacío.
    const lines = [linea({ item_id: 'i1', pending: 0, available: { [MELIPAL]: 10 } })];
    for (const c of buildLocationCoverage(lines, sucursales)) assert.equal(c.covers_all, false);
  });

  it('si ninguna cubre todo, ordena por cuántas líneas cubre', () => {
    const lines = [
      linea({ item_id: 'i1', pending: 5, available: { [ELFLEIN]: 1, [MELIPAL]: 1 } }),
      linea({ item_id: 'i2', pending: 1, available: { [ELFLEIN]: 0, [MELIPAL]: 4 } }),
    ];
    const coverage = buildLocationCoverage(lines, sucursales);
    assert.equal(coverage[0].stock_location_id, MELIPAL);
    assert.equal(coverage[0].covered_lines, 1);
    assert.equal(coverage[1].covered_lines, 0);
  });

  it('sin sucursales mapeadas devuelve vacío y no rompe', () => {
    assert.deepEqual(buildLocationCoverage([linea({ item_id: 'i1' })], []), []);
  });
});
