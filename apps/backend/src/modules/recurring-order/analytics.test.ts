import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTopProducts,
  churnRate,
  dayRange,
  monthlyFactor,
  subscriptionMonthlyValue,
} from './analytics.ts';

describe('monthlyFactor', () => {
  it('normaliza a 30 días', () => {
    assert.equal(monthlyFactor('day', 1), 30);
    assert.equal(monthlyFactor('week', 1), 30 / 7);
    assert.equal(monthlyFactor('week', 2), 30 / 14);
    assert.equal(monthlyFactor('month', 1), 1);
  });
});

describe('subscriptionMonthlyValue', () => {
  it('suma snapshots × cantidad y normaliza por frecuencia', () => {
    const value = subscriptionMonthlyValue({
      frequency_interval: 'week',
      frequency_count: 1,
      items: [
        { quantity: 2, pricing_snapshot: { unit_price: 100 } },
        { quantity: 1, pricing_snapshot: { unit_price: 50 } },
      ],
    });
    // 250 por entrega semanal → ×30/7 mensual.
    assert.ok(Math.abs(value - 250 * (30 / 7)) < 0.001);
  });

  it('aplica el descuento de suscripción del snapshot', () => {
    const value = subscriptionMonthlyValue({
      frequency_interval: 'month',
      frequency_count: 1,
      items: [{ quantity: 1, pricing_snapshot: { unit_price: 100, discount_percentage: 10 } }],
    });
    assert.equal(value, 90);
  });

  it('ignora items sin precio', () => {
    const value = subscriptionMonthlyValue({
      frequency_interval: 'month',
      frequency_count: 1,
      items: [{ quantity: 3, pricing_snapshot: null }],
    });
    assert.equal(value, 0);
  });
});

describe('churnRate', () => {
  it('bajas sobre activos al inicio; 0 sin base', () => {
    assert.equal(churnRate(5, 100), 0.05);
    assert.equal(churnRate(3, 0), 0);
  });
});

describe('buildTopProducts', () => {
  it('cuenta suscripciones únicas por producto y ordena desc', () => {
    const top = buildTopProducts([
      {
        items: [
          { product_id: 'p1', product_snapshot: { title: 'Leche' } },
          { product_id: 'p1', product_snapshot: { title: 'Leche' } }, // repetido: cuenta 1
          { product_id: 'p2', product_snapshot: { title: 'Pan' } },
        ],
      },
      { items: [{ product_id: 'p1', product_snapshot: { title: 'Leche' } }] },
    ]);
    assert.deepEqual(top[0], { product_id: 'p1', title: 'Leche', subscriptions: 2 });
    assert.deepEqual(top[1], { product_id: 'p2', title: 'Pan', subscriptions: 1 });
  });
});

describe('dayRange', () => {
  it('rango UTC [inicio, fin) del día', () => {
    const { start, end } = dayRange('2026-07-20');
    assert.equal(start.toISOString(), '2026-07-20T00:00:00.000Z');
    assert.equal(end.toISOString(), '2026-07-21T00:00:00.000Z');
  });
});
