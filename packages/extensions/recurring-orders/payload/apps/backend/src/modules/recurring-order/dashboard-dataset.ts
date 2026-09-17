import {
  registerDashboardDataset,
  defineDataset,
  commonDimensions,
  metric,
  type Context,
  type Query,
  type Result,
} from '@minimalart/mercatto-analytics-contract';
import { factDataset, previousContext } from '@minimalart/mercatto-analytics-contract/facts';
import { compareRows, type Fact } from '@minimalart/mercatto-analytics-contract/aggregate';
import { getRecurringOrderConfig } from './config';
import { subscriptionMonthlyValue } from './analytics';
const timeDimensions = (['hour', 'day', 'week', 'month'] as const).map((id) => ({
  id,
  label: {
    en: id,
    es: { hour: 'Hora', day: 'Día', week: 'Semana', month: 'Mes' }[id],
  },
}));
const dimensions = [...commonDimensions, ...timeDimensions];
const metrics = [
  metric('active', 'Active subscriptions', 'Suscripciones activas'),
  metric('mrr', 'Estimated MRR (30-day month)', 'MRR estimado (mes de 30 días)', 'money'),
  metric('new', 'New subscriptions', 'Altas', 'number', 'flow'),
  metric('cancelled', 'Cancellations', 'Bajas', 'number', 'flow'),
  metric(
    'churn',
    'Cancellations / active at start',
    'Bajas / activas al inicio',
    'percent',
    'flow',
    ['store', 'channel']
  ),
].map((m) => ({ ...m, dimensions: m.id === 'churn' ? m.dimensions : dimensions.map((d) => d.id) }));
const definition = defineDataset(
  'subscriptions',
  { en: 'Subscriptions', es: 'Suscripciones' },
  metrics,
  dimensions
);
const provider = factDataset({
  definition,
  resource: 'recurring_order',
  available: async (scope) => {
    try {
      scope.resolve('recurring_order');
      return getRecurringOrderConfig().enabled;
    } catch {
      return false;
    }
  },
  measures: {
    active: { unit: 'number', numerator: 'active' },
    mrr: { unit: 'money', numerator: 'mrr' },
    new: { unit: 'number', numerator: 'new' },
    cancelled: { unit: 'number', numerator: 'cancelled' },
  },
  async read(scope, context) {
    const db = scope.resolve('__pg_connection__');
    let q = db('recurring_order as r')
      .whereNull('r.deleted_at')
      .select('r.*')
      .select(
        db.raw(
          `(SELECT json_agg(json_build_object('quantity',i.quantity,'pricing_snapshot',i.pricing_snapshot)) FROM recurring_order_item i WHERE i.recurring_order_id=r.id AND i.deleted_at IS NULL) items`
        )
      );
    if (context.channelIds !== null) q = q.whereIn('r.sales_channel_id', context.channelIds);
    const rows = await q.limit(100001);
    if (rows.length > 100000) throw new Error('Subscription query exceeds record limit');
    return rows.flatMap((r: any): Fact[] => {
      const base = {
        currency: r.currency_code,
        dimensions: { channel: r.sales_channel_id, status: r.status },
      };
      return [
        {
          ...base,
          id: `state:${r.id}`,
          at: new Date().toISOString(),
          values: {
            active: r.status === 'active' ? 1 : 0,
            mrr:
              r.status === 'active' ? subscriptionMonthlyValue({ ...r, items: r.items ?? [] }) : 0,
          },
        },
        {
          ...base,
          id: `new:${r.id}`,
          at: new Date(r.created_at).toISOString(),
          values: { new: 1 },
        },
        ...(r.cancelled_at
          ? [
              {
                ...base,
                id: `cancel:${r.id}`,
                at: new Date(r.cancelled_at).toISOString(),
                values: { cancelled: 1 },
              },
            ]
          : []),
      ];
    });
  },
});
const execute = provider.execute.bind(provider);
provider.execute = async (query: Query, context: Context, scope: unknown) => {
  if (query.metric !== 'churn') return execute(query, context, scope);
  const read = async (c: Context): Promise<Result> => {
    const cancelled = await execute(
      { ...query, metric: 'cancelled', comparison: 'none' },
      c,
      scope
    );
    const active = await execute(
      { ...query, metric: 'active', comparison: 'none' },
      { ...c, from: new Date(+new Date(c.from) - 300000).toISOString(), to: c.from },
      scope
    );
    const keys = [...new Set([...cancelled.rows, ...active.rows].map((r) => r.key))];
    const rows = keys.flatMap((key) => {
      const baseline = active.rows.find((r) => r.key === key)?.value;
      return baseline
        ? [
            {
              key,
              currency: null,
              value: (cancelled.rows.find((r) => r.key === key)?.value ?? 0) / baseline,
            },
          ]
        : [];
    });
    return {
      ...cancelled,
      unit: 'percent' as const,
      history: active.history,
      stale: cancelled.stale || active.stale,
      rows,
    };
  };
  const current = await read(context);
  if (query.comparison !== 'none') {
    const previous = await read(previousContext(context, query.comparison));
    current.rows = compareRows(current.rows, previous.rows, false);
    if (previous.history === 'insufficient') current.history = 'insufficient';
  }
  return current;
};
registerDashboardDataset(provider);
