/**
 * Lectura de la pantalla de Rendimiento (PRD §16.3). Los ratios se calculan ACÁ, al leer,
 * y no se guardan: un promedio de promedios no cierra cuando el usuario filtra.
 */

export type MetricRow = {
  period_start: string | Date;
  placement: string | null;
  strategy_key: string | null;
  resolved_strategy_key: string | null;
  sales_channel_id: string | null;
  served: number;
  served_items: number;
  viewed: number;
  clicked: number;
  added_to_cart: number;
  purchased: number;
  units_purchased: number;
  attributed_revenue: number;
  assisted_revenue: number;
  influenced_orders: number;
  influenced_order_revenue: number;
};

export type PerformanceTotals = {
  served: number;
  served_items: number;
  viewed: number;
  clicked: number;
  added_to_cart: number;
  purchased: number;
  units_purchased: number;
  attributed_revenue: number;
  assisted_revenue: number;
  influenced_orders: number;
  influenced_order_revenue: number;
  /** clics / vistas */
  ctr: number;
  /** agregados / clics */
  add_to_cart_rate: number;
  /** compras / clics */
  conversion_rate: number;
  /** ticket promedio de las órdenes influenciadas */
  influenced_aov: number;
};

const numberOf = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** División segura: 0 en lugar de NaN/Infinity cuando el denominador es 0. */
export const safeRatio = (value: number, total: number): number => (total > 0 ? value / total : 0);

const EMPTY_SUMS = {
  served: 0,
  served_items: 0,
  viewed: 0,
  clicked: 0,
  added_to_cart: 0,
  purchased: 0,
  units_purchased: 0,
  attributed_revenue: 0,
  assisted_revenue: 0,
  influenced_orders: 0,
  influenced_order_revenue: 0,
};

type Sums = typeof EMPTY_SUMS;

const addRow = (sums: Sums, row: MetricRow): Sums => ({
  served: sums.served + numberOf(row.served),
  served_items: sums.served_items + numberOf(row.served_items),
  viewed: sums.viewed + numberOf(row.viewed),
  clicked: sums.clicked + numberOf(row.clicked),
  added_to_cart: sums.added_to_cart + numberOf(row.added_to_cart),
  purchased: sums.purchased + numberOf(row.purchased),
  units_purchased: sums.units_purchased + numberOf(row.units_purchased),
  attributed_revenue: sums.attributed_revenue + numberOf(row.attributed_revenue),
  assisted_revenue: sums.assisted_revenue + numberOf(row.assisted_revenue),
  influenced_orders: sums.influenced_orders + numberOf(row.influenced_orders),
  influenced_order_revenue: sums.influenced_order_revenue + numberOf(row.influenced_order_revenue),
});

const withRatios = (sums: Sums): PerformanceTotals => ({
  ...sums,
  // CTR sobre VISTAS y no sobre servidos: el PRD §14.2 distingue "el servidor lo
  // devolvió" de "el usuario lo vio", y dividir por servidos daría un CTR artificialmente
  // bajo (los rails abajo del fold se sirven pero no se ven).
  ctr: safeRatio(sums.clicked, sums.viewed),
  add_to_cart_rate: safeRatio(sums.added_to_cart, sums.clicked),
  conversion_rate: safeRatio(sums.purchased, sums.clicked),
  influenced_aov: safeRatio(sums.influenced_order_revenue, sums.influenced_orders),
});

/** Totales del período completo. */
export const summarizeMetrics = (rows: MetricRow[]): PerformanceTotals =>
  withRatios(rows.reduce(addRow, { ...EMPTY_SUMS }));

/** Agrupa por una dimensión y calcula ratios por grupo. */
export function groupMetrics(
  rows: MetricRow[],
  dimension: 'placement' | 'strategy_key' | 'resolved_strategy_key',
): Array<{ key: string } & PerformanceTotals> {
  const grouped = new Map<string, Sums>();
  for (const row of rows) {
    const key = row[dimension] ?? '—';
    grouped.set(key, addRow(grouped.get(key) ?? { ...EMPTY_SUMS }, row));
  }
  return [...grouped.entries()]
    .map(([key, sums]) => ({ key, ...withRatios(sums) }))
    // Ordenado por revenue atribuido: es la pregunta que trae al merchant a esta pantalla.
    .sort((a, b) => b.attributed_revenue - a.attributed_revenue);
}

/** Serie temporal para el gráfico, ordenada cronológicamente. */
export function timeSeries(rows: MetricRow[]): Array<{ period: string } & PerformanceTotals> {
  const grouped = new Map<string, Sums>();
  for (const row of rows) {
    const key = new Date(row.period_start).toISOString();
    grouped.set(key, addRow(grouped.get(key) ?? { ...EMPTY_SUMS }, row));
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, sums]) => ({ period, ...withRatios(sums) }));
}
