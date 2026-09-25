import {
  registerDashboardDataset,
  defineDataset,
  commonDimensions,
  metric,
} from '@minimalart/mercatto-analytics-contract';
import { factDataset } from '@minimalart/mercatto-analytics-contract/facts';
import { orderAmounts } from '@minimalart/mercatto-analytics-contract/orders';
const dimensions = [
  ...commonDimensions,
  { id: 'company', label: { en: 'Company', es: 'Empresa' } },
];
const definition = defineDataset(
  'b2b',
  { en: 'B2B', es: 'B2B' },
  [
    metric('sales', 'B2B sales', 'Ventas B2B', 'money', 'flow'),
    metric('companies', 'Companies', 'Empresas'),
    metric('accounts', 'Credit accounts', 'Cuentas corrientes'),
    metric('credit_used', 'Used credit', 'Crédito utilizado', 'money'),
    metric('credit_available', 'Available credit', 'Crédito disponible', 'money'),
  ].map((m) => ({
    ...m,
    dimensions: [
      ...dimensions.map((d) => d.id),
      ...(m.temporal === 'flow' ? ['hour', 'day', 'week', 'month'] : []),
    ],
  })),
  dimensions
);
registerDashboardDataset(
  factDataset({
    definition,
    resource: 'company',
    available: async (scope) => {
      try {
        scope.resolve('company');
        scope.resolve('company_credit');
        return true;
      } catch {
        return false;
      }
    },
    measures: {
      sales: { unit: 'money', numerator: 'sales' },
      companies: { unit: 'number', numerator: 'companies' },
      accounts: { unit: 'number', numerator: 'accounts' },
      credit_used: { unit: 'money', numerator: 'credit_used' },
      credit_available: { unit: 'money', numerator: 'credit_available' },
    },
    async read(scope, context) {
      const db = scope.resolve('__pg_connection__');
      let q = db('company as c')
        .leftJoin('company_credit_account as a', function (this: any) {
          this.on('a.company_id', '=', 'c.id').andOnNull('a.deleted_at');
        })
        .whereNull('c.deleted_at')
        .select(
          'c.id',
          'c.sales_channel_id',
          'c.status',
          'a.id as account_id',
          'a.currency_code',
          'a.credit_limit',
          'a.current_balance'
        );
      if (context.channelIds !== null) q = q.whereIn('c.sales_channel_id', context.channelIds);
      const rows = await q.limit(100001);
      if (rows.length > 100000) throw new Error('B2B query exceeds record limit');
      let orders = db('order as o')
        .join('company as c', function (this: any) {
          this.on('c.id', '=', db.raw("o.metadata->>'company_id'"));
        })
        .whereNull('o.deleted_at')
        .whereNull('c.deleted_at')
        // Solo los valores reales de order_status_enum: pending, completed,
        // draft, archived, canceled, requires_action. 'cancelled' con doble L no
        // existe, y como binding contra la columna enum Postgres rechaza la
        // consulta entera en vez de ignorarlo.
        .whereNotIn('o.status', ['draft', 'canceled'])
        .whereRaw('NOT COALESCE(o.is_draft_order,false)')
        .where('o.created_at', '>=', context.from)
        .where('o.created_at', '<', context.to)
        .select(
          'o.id',
          'o.created_at',
          'o.currency_code',
          'o.sales_channel_id',
          'o.status',
          'c.id as company_id'
        );
      if (context.channelIds !== null)
        orders = orders.whereIn('o.sales_channel_id', context.channelIds);
      const sales = await orders.limit(100001);
      if (sales.length > 100000) throw new Error('B2B sales query exceeds record limit');
      const amounts = await orderAmounts(
        scope,
        sales.map((r: any) => r.id)
      );
      const flow = sales.map((r: any) => ({
        id: 'sale:' + r.id,
        at: new Date(r.created_at).toISOString(),
        currency: r.currency_code,
        dimensions: { channel: r.sales_channel_id, status: r.status, company: r.company_id },
        values: { sales: Number(amounts.get(r.id).total) },
      }));
      return [
        ...flow,
        ...rows.map((r: any) => ({
          id: 'company:' + r.id,
          at: new Date().toISOString(),
          currency: r.currency_code ?? null,
          dimensions: { channel: r.sales_channel_id, status: r.status, company: r.id },
          values: {
            companies: 1,
            accounts: r.account_id ? 1 : 0,
            credit_used: Number(r.current_balance ?? 0),
            credit_available: Number(r.credit_limit ?? 0) - Number(r.current_balance ?? 0),
          },
        })),
      ];
    },
  })
);
