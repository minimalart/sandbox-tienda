import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planStockUpdate, type SkuCatalogEntry } from './plan-stock-updates.ts';

const entry = (overrides: Partial<SkuCatalogEntry> = {}): SkuCatalogEntry => ({
  sku: 'ABC-123',
  variant_ids: ['var_1'],
  inventory_item_id: 'iitem_1',
  ...overrides,
});

const level = (stocked = 5, reserved = 0) => ({
  stocked_quantity: stocked,
  reserved_quantity: reserved,
});

describe('planStockUpdate — máquina de estados por SKU', () => {
  it('SKU duplicado en Medusa → duplicate_sku sin update', () => {
    const plan = planStockUpdate({
      entry: entry({ variant_ids: ['var_1', 'var_2'] }),
      erpResult: { found: true, quantity: 10 },
      level: level(),
    });
    assert.equal(plan.status, 'duplicate_sku');
    assert.equal(plan.update, undefined);
    assert.deepEqual(plan.response_payload.variant_ids, ['var_1', 'var_2']);
  });

  it('ERP no conoce el SKU (found:false o ausente) → not_found', () => {
    assert.equal(
      planStockUpdate({ entry: entry(), erpResult: { found: false }, level: level() }).status,
      'not_found'
    );
    assert.equal(
      planStockUpdate({ entry: entry(), erpResult: undefined, level: level() }).status,
      'not_found'
    );
  });

  it('variante sin inventory_item → skipped(no_inventory_item)', () => {
    const plan = planStockUpdate({
      entry: entry({ inventory_item_id: null }),
      erpResult: { found: true, quantity: 10 },
      level: null,
    });
    assert.equal(plan.status, 'skipped');
    assert.equal(plan.response_payload.reason, 'no_inventory_item');
  });

  it('cantidad no numérica o no finita → invalid_quantity', () => {
    for (const quantity of ['25', null, undefined, NaN, Infinity, {}]) {
      const plan = planStockUpdate({
        entry: entry(),
        erpResult: { found: true, quantity },
        level: level(),
      });
      assert.equal(plan.status, 'invalid_quantity', `quantity=${String(quantity)}`);
      assert.equal(plan.update, undefined);
    }
  });

  it('negativa → se normaliza a 0 con warning y actualiza', () => {
    const plan = planStockUpdate({
      entry: entry(),
      erpResult: { found: true, quantity: -5 },
      level: level(3),
    });
    assert.equal(plan.status, 'updated');
    assert.equal(plan.update?.stocked_quantity, 0);
    assert.equal(plan.response_payload.warning, 'negative_normalized_to_zero');
  });

  it('fraccional → piso con flag', () => {
    const plan = planStockUpdate({
      entry: entry(),
      erpResult: { found: true, quantity: 7.8 },
      level: level(3),
    });
    assert.equal(plan.update?.stocked_quantity, 7);
    assert.equal(plan.response_payload.fractional_floored, true);
  });

  it('sin nivel en la location → updated con create:true (crea el nivel)', () => {
    const plan = planStockUpdate({
      entry: entry(),
      erpResult: { found: true, quantity: 10 },
      level: null,
    });
    assert.equal(plan.status, 'updated');
    assert.equal(plan.update?.stocked_quantity, 10);
    assert.equal(plan.update?.create, true);
    assert.equal(plan.response_payload.created_level, true);
    assert.equal(plan.response_payload.erp_quantity, 10);
    // Sin nivel previo no hay `previous_stocked` que registrar.
    assert.equal(plan.response_payload.previous_stocked, undefined);
  });

  it('sin nivel + cantidad negativa → updated con create:true y qty 0', () => {
    const plan = planStockUpdate({
      entry: entry(),
      erpResult: { found: true, quantity: -3 },
      level: null,
    });
    assert.equal(plan.status, 'updated');
    assert.equal(plan.update?.stocked_quantity, 0);
    assert.equal(plan.update?.create, true);
    assert.equal(plan.response_payload.warning, 'negative_normalized_to_zero');
  });

  it('cantidad igual al stocked actual → skipped(unchanged)', () => {
    const plan = planStockUpdate({
      entry: entry(),
      erpResult: { found: true, quantity: 5 },
      level: level(5),
    });
    assert.equal(plan.status, 'skipped');
    assert.equal(plan.response_payload.reason, 'unchanged');
  });

  it('cambio real → updated con payload de auditoría', () => {
    const plan = planStockUpdate({
      entry: entry(),
      erpResult: { found: true, quantity: 25 },
      level: level(5),
    });
    assert.equal(plan.status, 'updated');
    assert.deepEqual(plan.update, { inventory_item_id: 'iitem_1', stocked_quantity: 25 });
    assert.equal(plan.response_payload.previous_stocked, 5);
    assert.equal(plan.response_payload.erp_quantity, 25);
  });

  it('reservas > 0 → deja constancia del disponible efectivo', () => {
    const plan = planStockUpdate({
      entry: entry(),
      erpResult: { found: true, quantity: 10 },
      level: level(5, 3),
    });
    assert.equal(plan.status, 'updated');
    assert.equal(plan.response_payload.reserved_quantity, 3);
    assert.equal(plan.response_payload.effective_available, 7);
  });
});
