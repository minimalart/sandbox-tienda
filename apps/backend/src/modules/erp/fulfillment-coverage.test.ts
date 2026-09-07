import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findUncoveredItems,
  pendingQuantity,
  type CoverageRequestedItem,
} from './fulfillment-coverage.ts';

describe('pendingQuantity', () => {
  it('usa el detail cuando está', () => {
    assert.equal(
      pendingQuantity({ id: 'i1', quantity: 5, detail: { quantity: 5, fulfilled_quantity: 2 } }),
      3
    );
  });

  it('cae a item.quantity cuando el detail no vino hidratado', () => {
    assert.equal(pendingQuantity({ id: 'i1', quantity: 4 }), 4);
  });

  it('nunca devuelve negativos', () => {
    assert.equal(pendingQuantity({ id: 'i1', detail: { quantity: 2, fulfilled_quantity: 5 } }), 0);
  });
});

describe('findUncoveredItems', () => {
  const items = [
    { id: 'i1', quantity: 3, detail: { quantity: 3, fulfilled_quantity: 0 } },
    { id: 'i2', quantity: 2, detail: { quantity: 2, fulfilled_quantity: 0 } },
  ];

  it('acepta el fulfillment que cubre todo', () => {
    assert.deepEqual(
      findUncoveredItems(items, [
        { id: 'i1', quantity: 3 },
        { id: 'i2', quantity: 2 },
      ]),
      []
    );
  });

  it('rechaza el parcial por cantidad: una orden, una factura', () => {
    assert.deepEqual(
      findUncoveredItems(items, [
        { id: 'i1', quantity: 1 },
        { id: 'i2', quantity: 2 },
      ]),
      [{ id: 'i1', pending: 3, requested: 1 }]
    );
  });

  it('rechaza el parcial por línea faltante', () => {
    assert.deepEqual(findUncoveredItems(items, [{ id: 'i1', quantity: 3 }]), [
      { id: 'i2', pending: 2, requested: 0 },
    ]);
  });

  it('ignora las líneas ya despachadas', () => {
    assert.deepEqual(
      findUncoveredItems(
        [
          { id: 'i1', quantity: 3, detail: { quantity: 3, fulfilled_quantity: 3 } },
          { id: 'i2', quantity: 2, detail: { quantity: 2, fulfilled_quantity: 0 } },
        ],
        [{ id: 'i2', quantity: 2 }]
      ),
      []
    );
  });

  it('un body basura NO puede resultar en "cubre todo"', () => {
    // El body llega del cliente. Un `id` que no es string o una cantidad que no
    // es número se ignoran, así que el parcial sigue siendo parcial.
    const gaps = findUncoveredItems(items, [
      { id: 42, quantity: 3 },
      { id: 'i1', quantity: 'tres' },
    ] as CoverageRequestedItem[]);
    assert.equal(gaps.length, 2);
  });

  it('suma líneas repetidas del mismo ítem', () => {
    assert.deepEqual(
      findUncoveredItems(items, [
        { id: 'i1', quantity: 1 },
        { id: 'i1', quantity: 2 },
        { id: 'i2', quantity: 2 },
      ]),
      []
    );
  });
});
