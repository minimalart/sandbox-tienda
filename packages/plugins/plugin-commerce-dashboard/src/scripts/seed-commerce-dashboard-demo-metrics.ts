import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

const currency = (process.env.COMMERCE_DASHBOARD_SEED_CURRENCY || 'ars').toLowerCase();
const country = (process.env.COMMERCE_DASHBOARD_SEED_COUNTRY || 'ar').toLowerCase();
const purchaseCount = Number(process.env.COMMERCE_DASHBOARD_SEED_PURCHASES || 20);

const id = (prefix: string, value: string) => `${prefix}_${Buffer.from(value).toString('hex').slice(0, 26)}`;

export default async function seedCommerceDashboardDemoMetrics({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const knex: any = container.resolve('__pg_connection__');

  const requiredTables = [
    'commerce_metrics_daily',
    'product_metrics_daily',
    'collection_metrics_daily',
    'customer_metrics_daily',
  ];

  for (const table of requiredTables) {
    if (!(await knex.schema.hasTable(table))) {
      throw new Error(`Missing ${table}. Run medusa db:migrate before seeding dashboard metrics.`);
    }
  }

  const salesChannel = await knex('sales_channel').whereNull('deleted_at').first('id', 'name');
  const products = await knex('product')
    .whereNull('deleted_at')
    .select('id', 'title', 'handle')
    .limit(Math.max(5, Math.min(purchaseCount, 20)));

  if (!products.length) {
    throw new Error('Cannot seed commerce dashboard metrics without products.');
  }

  const now = new Date();
  const rows = Array.from({ length: purchaseCount }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (purchaseCount - index - 1));
    date.setHours(0, 0, 0, 0);
    const periodEnd = new Date(date);
    periodEnd.setDate(date.getDate() + 1);

    const product = products[index % products.length];
    const units = 1 + (index % 4);
    const revenue = 3500 + index * 475 + units * 900;

    return {
      periodStart: date,
      periodEnd,
      product,
      units,
      revenue,
      orders: 1,
      isReturning: index % 3 === 0,
    };
  });

  await knex.transaction(async (trx: any) => {
    const firstRow = rows[0];
    const lastRow = rows[rows.length - 1];
    if (!firstRow || !lastRow) {
      throw new Error('No demo rows generated.');
    }
    const minDate = firstRow.periodStart;
    const maxDate = lastRow.periodStart;

    for (const table of requiredTables) {
      await trx(table)
        .where('bucket', 'daily')
        .where('period_start', '>=', minDate)
        .where('period_start', '<=', maxDate)
        .where('currency_code', currency)
        .delete();
    }

    for (const row of rows) {
      const key = `${row.periodStart.toISOString()}-${currency}-${row.product.id}`;
      const salesChannelId = salesChannel?.id ?? null;
      const returning = row.isReturning ? 1 : 0;
      const fresh = row.isReturning ? 0 : 1;

      await trx('commerce_metrics_daily').insert({
        id: id('cmd', key),
        bucket: 'daily',
        period_start: row.periodStart,
        period_end: row.periodEnd,
        sales_channel_id: salesChannelId,
        country_code: country,
        currency_code: currency,
        revenue: row.revenue,
        orders: row.orders,
        aov: row.revenue / row.orders,
        units_sold: row.units,
        new_customers: fresh,
        returning_customers: returning,
        refunds: 0,
        conversion_proxy: row.orders,
        repeat_purchase_rate: returning ? 1 : 0,
        metadata: { source: 'seed-commerce-dashboard-demo-metrics', synthetic: true },
        aggregated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      await trx('product_metrics_daily').insert({
        id: id('pmd', key),
        bucket: 'daily',
        period_start: row.periodStart,
        period_end: row.periodEnd,
        sales_channel_id: salesChannelId,
        country_code: country,
        currency_code: currency,
        product_id: row.product.id,
        product_title: row.product.title,
        product_handle: row.product.handle,
        revenue: row.revenue,
        orders: row.orders,
        units_sold: row.units,
        refunds: 0,
        metadata: { source: 'seed-commerce-dashboard-demo-metrics', synthetic: true },
        aggregated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      await trx('collection_metrics_daily').insert({
        id: id('colmd', key),
        bucket: 'daily',
        period_start: row.periodStart,
        period_end: row.periodEnd,
        sales_channel_id: salesChannelId,
        country_code: country,
        currency_code: currency,
        collection_id: null,
        collection_title: 'Demo',
        category_id: 'demo-category',
        category_name: 'Demo',
        revenue: row.revenue,
        orders: row.orders,
        units_sold: row.units,
        refunds: 0,
        metadata: { source: 'seed-commerce-dashboard-demo-metrics', synthetic: true },
        aggregated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      await trx('customer_metrics_daily').insert({
        id: id('cumd', key),
        bucket: 'daily',
        period_start: row.periodStart,
        period_end: row.periodEnd,
        sales_channel_id: salesChannelId,
        country_code: country,
        currency_code: currency,
        new_customers: fresh,
        returning_customers: returning,
        customers_with_orders: 1,
        repeat_customers: returning,
        repeat_purchase_rate: returning ? 1 : 0,
        metadata: { source: 'seed-commerce-dashboard-demo-metrics', synthetic: true },
        aggregated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  });

  logger.info(
    `[commerce-dashboard] seeded ${purchaseCount} synthetic purchase snapshots for ${currency.toUpperCase()} (${salesChannel?.name ?? 'all channels'})`,
  );
}
