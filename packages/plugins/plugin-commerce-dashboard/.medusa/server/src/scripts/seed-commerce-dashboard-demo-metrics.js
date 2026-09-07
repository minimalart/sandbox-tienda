"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = seedCommerceDashboardDemoMetrics;
const utils_1 = require("@medusajs/framework/utils");
const currency = (process.env.COMMERCE_DASHBOARD_SEED_CURRENCY || 'ars').toLowerCase();
const country = (process.env.COMMERCE_DASHBOARD_SEED_COUNTRY || 'ar').toLowerCase();
const purchaseCount = Number(process.env.COMMERCE_DASHBOARD_SEED_PURCHASES || 20);
const id = (prefix, value) => `${prefix}_${Buffer.from(value).toString('hex').slice(0, 26)}`;
async function seedCommerceDashboardDemoMetrics({ container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const knex = container.resolve('__pg_connection__');
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
    await knex.transaction(async (trx) => {
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
    logger.info(`[commerce-dashboard] seeded ${purchaseCount} synthetic purchase snapshots for ${currency.toUpperCase()} (${salesChannel?.name ?? 'all channels'})`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC1jb21tZXJjZS1kYXNoYm9hcmQtZGVtby1tZXRyaWNzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjcmlwdHMvc2VlZC1jb21tZXJjZS1kYXNoYm9hcmQtZGVtby1tZXRyaWNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBU0EsbURBb0tDO0FBNUtELHFEQUFzRTtBQUV0RSxNQUFNLFFBQVEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLElBQUksS0FBSyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDdkYsTUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixJQUFJLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQ3BGLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGlDQUFpQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBRWxGLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBYyxFQUFFLEtBQWEsRUFBRSxFQUFFLENBQUMsR0FBRyxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO0FBRTlGLEtBQUssVUFBVSxnQ0FBZ0MsQ0FBQyxFQUFFLFNBQVMsRUFBWTtJQUNwRixNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25FLE1BQU0sSUFBSSxHQUFRLFNBQVMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUV6RCxNQUFNLGNBQWMsR0FBRztRQUNyQix3QkFBd0I7UUFDeEIsdUJBQXVCO1FBQ3ZCLDBCQUEwQjtRQUMxQix3QkFBd0I7S0FDekIsQ0FBQztJQUVGLEtBQUssTUFBTSxL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