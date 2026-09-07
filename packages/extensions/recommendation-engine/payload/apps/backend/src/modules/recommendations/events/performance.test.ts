import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  groupMetrics,
  safeRatio,
  summarizeMetrics,
  timeSeries,
  type MetricRow,
} from './performance';

const row = (overrides: Partial<MetricRow> = {}): MetricRow => ({
  period_start: '2026-07-24T00:00:00.000Z',
  placement: 'product-detail-fbt',
  strategy_key: 'frequently_bought_together',
  resolved_strategy_key: 'manual',
  sales_channel_id: 'sc_main',
  served: 100,
  served_items: 800,
  viewed: 50,
  clicked: 10,
  added_to_cart: 4,
  purchased: 2,
  units_purchased: 3,
  attributed_revenue: 20_000,
  assisted_revenue: 5_000,
  influenced_orders: 2,
  influenced_order_revenue: 60_000,
  ...overrides,
});

describe('safeRatio', () => {
  it('devuelve 0 en lugar de NaN o Infinity', () => {
    assert.equal(safeRatio(5, 0), 0);
    assert.equal(safeRatio(0, 0), 0);
    assert.equal(safeRatio(1, 4), 0.25);
  });
});

describe('summarizeMetrics', () => {
  it('suma medidas y calcula ratios', () => {
    const totals = summarizeMetrics([row(), row()]);
    assert.equal(totals.viewed, 100);
    assert.equal(totals.clicked, 20);
    assert.equal(totals.attributed_revenue, 40_000);
    assert.equal(totals.ctr, 0.2); // 20 clics / 100 vistas
    assert.equal(totals.add_to_cart_rate, 0.4); // 8 / 20
    assert.equal(totals.conversion_rate, 0.2); // 4 / 20
  });

  it('el CTR se calcula sobre VISTAS y no sobre servidos', () => {
    // El PRD §14.2 distingue "el servidor lo devolvió" de "el usuario lo vio". Dividir por
    // servidos daría un CTR artificialmente bajo por los rails que quedan abajo del fold.
    const totals = summarizeMetrics([row({ served: 1000, viewed: 100, clicked: 10 })]);
    assert.equal(totals.ctr, 0.1);
  });

  it('el ticket promedio influenciado divide por ÓRDENES y no por compras', () => {
    // Una orden con 3 productos recomendados es UNA orden influenciada. Si se dividiera
    // por compras, el AOV saldría dividido por tres.
    const totals = summarizeMetrics([
      row({ purchased: 3, influenced_orders: 1, influenced_order_revenue: 90_000 }),
    ]);
    assert.equal(totals.influenced_aov, 90_000);
  });

  it('nunca suma revenue directo con asistido', () => {
    // El PRD §14.4 exige reportarlos separados: sumarlos da un número indefendible.
    const totals = summarizeMetrics([row({ attributed_revenue: 100, assisted_revenue: 900 })]);
    assert.equal(totals.attributed_revenue, 100);
    assert.equal(totals.assisted_revenue, 900);
    assert.equal((totals as Record<string, unknown>).total_revenue, undefined);
  });

  it('con lista vacía devuelve todo en cero sin NaN', () => {
    const totals = summarizeMetrics([]);
    for (const value of Object.values(totals)) {
      assert.ok(Number.isFinite(value), 'todo tiene que ser finito');
    }
    assert.equal(totals.ctr, 0);
  });

  it('tolera numéricos que llegan como string desde Postgres', () => {
    const totals = summarizeMetrics([
      row({ clicked: '10' as unknown as number, attributed_revenue: '2500.50' as unknown as number }),
    ]);
    assert.equal(totals.clicked, 10);
    assert.equal(totals.attributed_revenue, 2500.5);
  });
});

describe('groupMetrics', () => {
  it('agrupa por dimensión y ordena por revenue atribuido', () => {
    const grouped = groupMetrics(
      [
        row({ placement: 'cart-recommendations', attributed_revenue: 5_000 }),
        row({ placement: 'product-detail-fbt', attributed_revenue: 50_000 }),
      ],
      'placement',
    );
    assert.deepEqual(
      grouped.map((entry) => entry.key),
      ['product-detail-fbt', 'cart-recommendations'],
    );
  });

  it('calcula ratios POR GRUPO y no globales', () => {
    const grouped = groupMetrics(
      [
        row({ placement: 'a', viewed: 100, clicked: 50 }),
        row({ placement: 'b', viewed: 100, clicked: 1 }),
      ],
      'placement',
    );
    assert.equal(grouped.find((g) => g.key === 'a')?.ctr, 0.5);
    assert.equal(grouped.find((g) => g.key === 'b')?.ctr, 0.01);
  });

  it('agrupa las dimensiones nulas bajo un guion', () => {
    const grouped = groupMetrics([row({ placement: null })], 'placement');
    assert.equal(grouped[0]?.key, '—');
  });
});

describe('timeSeries', () => {
  it('ordena cronológicamente y agrega por período', () => {
    const series = timeSeries([
      row({ period_start: '2026-07-25T00:00:00.000Z', clicked: 1 }),
      row({ period_start: '2026-07-24T00:00:00.000Z', clicked: 2 }),
      row({ period_start: '2026-07-24T00:00:00.000Z', clicked: 3 }),
    ]);
    assert.equal(series.length, 2);
    assert.equal(series[0]?.clicked, 5);
    assert.equal(series[1]?.clicked, 1);
    assert.ok((series[0]?.period ?? '') < (series[1]?.period ?? ''));
  });
});
