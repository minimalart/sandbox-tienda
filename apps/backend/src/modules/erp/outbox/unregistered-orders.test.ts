import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyUnregisteredOrder,
  selectUnregisteredOrders,
  type OrderEligibilityInput,
} from './unregistered-orders.ts';

describe('classifyUnregisteredOrder — trigger payment_captured', () => {
  const T = 'payment_captured' as const;

  it('una orden con el pago capturado es elegible', () => {
    assert.equal(
      classifyUnregisteredOrder({ id: 'o1', payment_status: 'captured' }, T),
      'eligible'
    );
  });

  it('una captura parcial también: es lo que el subscriber produce', () => {
    assert.equal(
      classifyUnregisteredOrder({ id: 'o1', payment_status: 'partially_captured' }, T),
      'eligible'
    );
  });

  it('authorized NO es elegible — el caso real de las 5 órdenes sin cobrar', () => {
    assert.equal(
      classifyUnregisteredOrder({ id: 'o1', payment_status: 'authorized' }, T),
      'not_captured'
    );
  });

  it('sin pago tampoco', () => {
    for (const payment_status of [
      'not_paid',
      'awaiting',
      'canceled',
      'refunded',
      null,
      undefined,
    ]) {
      assert.equal(
        classifyUnregisteredOrder({ id: 'o1', payment_status }, T),
        'not_captured',
        `${payment_status} no puede ser elegible`
      );
    }
  });

  it('una orden cancelada nunca es elegible, ni cobrada', () => {
    assert.equal(
      classifyUnregisteredOrder({ id: 'o1', status: 'canceled', payment_status: 'captured' }, T),
      'order_canceled'
    );
  });

  it('un fulfillment cancelado NO descalifica: la orden sigue cobrada', () => {
    // La orden #14 real: payment captured, fulfillment_status canceled.
    assert.equal(
      classifyUnregisteredOrder(
        {
          id: 'o14',
          status: 'pending',
          payment_status: 'captured',
          fulfillment_status: 'canceled',
        },
        T
      ),
      'eligible'
    );
  });
});

describe('classifyUnregisteredOrder — trigger fulfillment_created', () => {
  const T = 'fulfillment_created' as const;

  it('cobrada pero sin despachar NO es elegible: falta confirmar el depósito', () => {
    assert.equal(
      classifyUnregisteredOrder(
        { id: 'o1', payment_status: 'captured', fulfillment_status: 'not_fulfilled' },
        T
      ),
      'not_fulfilled'
    );
  });

  it('despachada es elegible', () => {
    for (const fulfillment_status of ['fulfilled', 'partially_fulfilled', 'shipped', 'delivered']) {
      assert.equal(
        classifyUnregisteredOrder({ id: 'o1', fulfillment_status }, T),
        'eligible',
        `${fulfillment_status} debería ser elegible`
      );
    }
  });

  it('un fulfillment cancelado no cuenta como despacho', () => {
    assert.equal(
      classifyUnregisteredOrder({ id: 'o1', fulfillment_status: 'canceled' }, T),
      'not_fulfilled'
    );
  });
});

describe('selectUnregisteredOrders', () => {
  /**
   * El corte real de desdeelsur del 2026-09-09: la #21 (18:27) es la última con
   * fila y de la #22 en adelante no hay ninguna, porque el event bus se murió.
   */
  const ORDENES: Array<OrderEligibilityInput & { display_id: number; created_at: string }> = [
    { id: 'o21', display_id: 21, created_at: '2026-09-09T18:27:00Z', payment_status: 'captured' },
    { id: 'o22', display_id: 22, created_at: '2026-09-09T18:51:00Z', payment_status: 'captured' },
    { id: 'o23', display_id: 23, created_at: '2026-09-09T18:53:00Z', payment_status: 'captured' },
    { id: 'o25', display_id: 25, created_at: '2026-09-09T20:05:00Z', payment_status: 'authorized' },
    { id: 'o30', display_id: 30, created_at: '2026-09-09T23:11:00Z', payment_status: 'captured' },
  ];

  it('devuelve sólo las capturadas sin fila, y explica los descartes', () => {
    const result = selectUnregisteredOrders({
      orders: ORDENES,
      existingOrderIds: ['o21'],
      trigger: 'payment_captured',
    });
    assert.deepEqual(
      result.orders.map((row) => row.display_id),
      [22, 23, 30]
    );
    assert.deepEqual(result.discarded, { not_captured: 1 });
  });

  it('una orden CON fila no aparece, ni siquiera skipped: la cubre el reenvío por estado', () => {
    const result = selectUnregisteredOrders({
      orders: ORDENES,
      existingOrderIds: ORDENES.map((o) => o.id),
      trigger: 'payment_captured',
    });
    assert.deepEqual(result.orders, []);
    assert.deepEqual(result.discarded, {}, 'una orden ya encolada no es un descarte, es otro tema');
  });

  it('con el trigger por fulfillment, las cobradas sin despachar no se ofrecen', () => {
    const result = selectUnregisteredOrders({
      orders: ORDENES,
      existingOrderIds: [],
      trigger: 'fulfillment_created',
    });
    assert.deepEqual(result.orders, []);
    assert.equal(result.discarded.not_fulfilled, 5);
  });

  it('preserva los datos que la pantalla necesita mostrar', () => {
    const [row] = selectUnregisteredOrders({
      orders: [
        {
          id: 'o22',
          display_id: 22,
          created_at: '2026-09-09T18:51:00Z',
          payment_status: 'captured',
          fulfillment_status: 'not_fulfilled',
          total: 232463.91,
        },
      ],
      existingOrderIds: [],
      trigger: 'payment_captured',
    }).orders;
    assert.deepEqual(row, {
      order_id: 'o22',
      display_id: 22,
      created_at: '2026-09-09T18:51:00Z',
      payment_status: 'captured',
      fulfillment_status: 'not_fulfilled',
      total: 232463.91,
    });
  });

  it('sin órdenes no inventa nada', () => {
    const result = selectUnregisteredOrders({
      orders: [],
      existingOrderIds: ['o1'],
      trigger: 'payment_captured',
    });
    assert.deepEqual(result.orders, []);
    assert.deepEqual(result.discarded, {});
  });
});
