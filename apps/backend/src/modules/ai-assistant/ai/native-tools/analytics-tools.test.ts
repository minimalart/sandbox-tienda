import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRange,
  previousRange,
  groupTrend,
  summarizeDashboard,
  aggregateOrders,
} from './analytics-tools.ts';
import {
  NATIVE_TOOL,
  NATIVE_TOOL_NAMES,
  NATIVE_ANALYSIS_TOOLS,
  isNativeToolBlockedInAnalysis,
} from './names.ts';

test('computeRange arma un rango inclusivo de N días con tope 365', () => {
  const now = new Date('2026-07-24T15:00:00Z');
  const r = computeRange(30, now);
  assert.equal(r.to, '2026-07-24');
  assert.equal(r.from, '2026-06-25');
  assert.equal(r.days, 30);
  assert.equal(computeRange(9999, now).days, 365);
  assert.equal(computeRange(undefined, now).days, 30);
  assert.equal(computeRange('no-numero', now).days, 30);
});

test('previousRange devuelve el período anterior del mismo largo, sin solaparse', () => {
  const now = new Date('2026-07-24T15:00:00Z');
  const r = computeRange(30, now);
  const prev = previousRange(r);
  assert.equal(prev.days, 30);
  assert.equal(prev.to, '2026-06-24');
  assert.equal(prev.from, '2026-05-26');
});

test('groupTrend achica una serie diaria a ≤ maxPoints sumando por tramo', () => {
  const points = Array.from({ length: 30 }, (_, i) => ({
    period: `2026-06-${String(i + 1).padStart(2, '0')}`,
    value: 10,
  }));
  const out = groupTrend(points, 8);
  assert.ok(out.length <= 8);
  assert.equal(
    out.reduce((a, c) => a + c.revenue, 0),
    300,
  );
  assert.equal(out[0].from, '2026-06-01');
  // Serie corta: queda tal cual.
  assert.equal(groupTrend(points.slice(0, 5), 8).length, 5);
  assert.deepEqual(groupTrend([], 8), []);
});

test('summarizeDashboard recorta y redondea la salida de getDashboard', () => {
  const dashboard = {
    kpis: {
      revenue: { value: 1234.5678, previous: 1000, delta: 23.45678 },
      orders: { value: 42, previous: 40, delta: 5 },
    },
    charts: {
      revenue_over_time: Array.from({ length: 20 }, (_, i) => ({
        period: new Date(Date.UTC(2026, 5, i + 1)),
        value: 100,
      })),
    },
    tables: {
      top_products: Array.from({ length: 15 }, (_, i) => ({
        id: `prod_${i}`,
        title: `Producto ${i}`,
        handle: `producto-${i}`,
        revenue: 100 - i,
        units_sold: 5,
        revenue_share: 0.1,
      })),
      top_categories: [],
      top_collections: [],
    },
    breakdowns: {
      sales_channels: [{ key: 'web', revenue: 900.129, orders: 30, revenue_share: 0.9 }],
      currencies: [{ key: 'ars', revenue: 1234.5678, orders: 42, revenue_share: 1 }],
    },
    customers: {
      repeat_purchase_rate: { value: 0.256789, previous: 0.2, delta: 28.39 },
    },
  };
  const out: any = summarizeDashboard(dashboard);
  assert.equal(out.kpis.revenue.value, 1234.57);
  assert.equal(out.kpis.revenue.delta_pct, 23.46);
  assert.equal(out.top_products.length, 10);
  assert.equal(out.top_products[0].revenue_share_pct, 10);
  assert.ok(out.weekly_trend.length <= 8);
  assert.equal(out.breakdowns.sales_channels[0].revenue, 900.13);
  assert.equal(out.customers.repeat_purchase_rate.value, 0.26);
});

test('aggregateOrders calcula revenue/AOV/top productos/monedas', () => {
  const rows = [
    {
      id: 'o1',
      total: 100,
      currency_code: 'ARS',
      customer_id: 'c1',
      items: [
        { product_id: 'p1', title: 'Uno', quantity: 2, total: 60 },
        { product_id: 'p2', title: 'Dos', quantity: 1, total: 40 },
      ],
    },
    {
      id: 'o2',
      total: 50.555,
      currency_code: 'ars',
      customer_id: 'c2',
      items: [{ product_id: 'p1', title: 'Uno', quantity: 1, total: 50.555 }],
    },
  ];
  const out = aggregateOrders(rows as any);
  assert.equal(out.orders, 2);
  assert.equal(out.revenue, 150.56);
  assert.equal(out.aov, 75.28);
  assert.equal(out.top_products[0].id, 'p1');
  assert.equal(out.top_products[0].units, 3);
  assert.equal(out.currencies.length, 1); // ARS y ars se normalizan
  assert.equal(out.currencies[0].key, 'ars');
  const empty = aggregateOrders([]);
  assert.equal(empty.orders, 0);
  assert.equal(empty.aov, 0);
});

test('las tools de análisis son nativas y el gate analysis-only bloquea las de escritura', () => {
  for (const name of NATIVE_ANALYSIS_TOOLS) {
    assert.ok(NATIVE_TOOL_NAMES.has(name), `${name} debe ser una tool nativa`);
  }
  // Escrituras nativas: bloqueadas SOLO en analysis-only.
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.preparePromotion, 'analysis-only'), true);
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.createBlogPost, 'analysis-only'), true);
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.startWorkflow, 'analysis-only'), true);
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.preparePromotion, 'all'), false);
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.preparePromotion, undefined), false);
  // Analytics y lecturas de campaña: nunca bloqueadas.
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.analyzeSales, 'analysis-only'), false);
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.analyzeProducts, 'analysis-only'), false);
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.analyzeCustomers, 'analysis-only'), false);
  assert.equal(isNativeToolBlockedInAnalysis(NATIVE_TOOL.campaignGet, 'analysis-only'), false);
  // Tools NO nativas (MCP): el gate no aplica (las gobierna ToolPolicy).
  assert.equal(isNativeToolBlockedInAnalysis('manage_medusa_admin_pricing', 'analysis-only'), false);
});
