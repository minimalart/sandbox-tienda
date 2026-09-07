import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quantityForTarget, type StockTarget } from './plan-stock-updates.ts';

/**
 * El reparto por depósito es la parte del multi-depósito que puede escribir mal
 * el stock en producción: si un destino se quedara con el TOTAL en vez de con la
 * cantidad de SU depósito, cada location sumaría el total y el stock se
 * multiplicaría por la cantidad de sucursales.
 */
const pool: StockTarget = { deposito: null, location_id: 'sloc_pool' };
const suc1: StockTarget = { deposito: '1', location_id: 'sloc_uno' };
const suc2: StockTarget = { deposito: '2', location_id: 'sloc_dos' };

describe('quantityForTarget', () => {
  const result = { found: true, quantity: 51, by_deposito: { '1': 43, '2': 8 } };

  it('sin mapeo devuelve el total tal cual (modo viejo)', () => {
    assert.deepEqual(quantityForTarget(result, pool), result);
  });

  it('con depósito devuelve SOLO la cantidad de ese depósito', () => {
    assert.deepEqual(quantityForTarget(result, suc1), { found: true, quantity: 43 });
    assert.deepEqual(quantityForTarget(result, suc2), { found: true, quantity: 8 });
  });

  it('la suma de los depósitos no supera el total (no se multiplica el stock)', () => {
    const total = [suc1, suc2].reduce(
      (sum, target) => sum + Number(quantityForTarget(result, target)?.quantity ?? 0),
      0
    );
    assert.equal(total, 51);
  });

  it('un depósito sin fila vale 0, no not_found', () => {
    // El artículo existe en el ERP: si devolviéramos not_found, el nivel viejo de
    // esa sucursal quedaría congelado cuando se queda sin unidades.
    assert.deepEqual(quantityForTarget(result, { deposito: '9', location_id: 'sloc_nueve' }), {
      found: true,
      quantity: 0,
    });
  });

  it('sin desglose del adapter no inventa: deja que el planner lo marque not_found', () => {
    assert.equal(quantityForTarget({ found: true, quantity: 51 }, suc1), undefined);
    // Sin mapeo, ese mismo resultado sirve igual.
    assert.deepEqual(quantityForTarget({ found: true, quantity: 51 }, pool), {
      found: true,
      quantity: 51,
    });
  });

  it('pasa de largo los not_found y los undefined', () => {
    assert.deepEqual(quantityForTarget({ found: false }, suc1), { found: false });
    assert.equal(quantityForTarget(undefined, suc1), undefined);
  });
});
