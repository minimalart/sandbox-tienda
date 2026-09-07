"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
const numberValue = (value) => Number(value ?? 0);
const safeRatio = (value, total) => (total > 0 ? value / total : 0);
class CommerceDashboardModuleService extends (0, utils_1.MedusaService)({
    CommerceMetricsDaily: models_1.CommerceMetricsDaily,
    ProductMetricsDaily: models_1.ProductMetricsDaily,
    CollectionMetricsDaily: models_1.CollectionMetricsDaily,
    CustomerMetricsDaily: models_1.CustomerMetricsDaily,
}) {
    get knex() {
        return this.__container__.manager.getKnex();
    }
    normalizeFilters(filters) {
        const from = new Date(filters.from);
        const to = new Date(filters.to);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new Error('Invalid date range');
        }
        if (from > to) {
            throw new Error('from must be before to');
        }
        const inclusiveTo = new Date(to);
        inclusiveTo.setHours(23, 59, 59, 999);
        const durationMs = inclusiveTo.getTime() - from.getTime();
        const previousTo = new Date(from.getTime() - 1);
        const previousFrom = new Date(previousTo.getTime() - durationMs);
        return {
            bucket: filters.bucket ?? 'daily',
            from,
            to: inclusiveTo,
            previousFrom,
            previousTo,
            sales_channel_id: filters.sales_channel_id || null,
            country_code: filters.country_code || null,
            currency_code: filters.currency_code || null,
        };
    }
    applyFilters(query, filters, range) {
        const from = range === 'current' ? filters.from : filters.previousFrom;
        const to = range === 'current' ? filters.to : filters.previousTo;
        query
            .where('bucket', filters.bucket)
            .where('period_start', '>=', from)
            .where('period_start', '<=', to)
            .whereNull('deleted_at');
        if (filters.sales_channel_id)
            query.where('sales_channel_id', filters.sales_channel_id);
        if (filters.country_code)
            query.where('country_code', filters.country_code);
        if (filters.currency_code)
            query.where('currency_code', filters.currency_code);
        return query;
    }
    summary(current, previous) {
        const delta = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
        return { value: current, previous, delta };
    }
    async commerceSummary(filters, range) {
        const [row] = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, range)
            .sum({
            revenue: 'revenue',
            orders: 'orders',
            units_sold: 'units_sold',
            new_customers: 'new_customers',
            returning_customers: 'returning_customers',
            refunds: 'refunds',
        })
            .avg({ conversion_proxy: 'conversion_proxy' });
        const orders = numberValue(row?.orders);
        const revenue = numberValue(row?.revenue);
        const newCustomers = numberValue(row?.new_customers);
        const returningCustomers = numberValue(row?.returning_customers);
        const totalCustomers = newCustomers + returningCustomers;
        return {
            revenue,
            orders,
            aov: orders > 0 ? revenue / orders : 0,
            units_sold: numberValue(row?.units_sold),
            new_customers: newCustomers,
            returning_customers: returningCustomers,
            refunds: numberValue(row?.refunds),
            conversion_proxy: numberValue(row?.conversion_proxy),
            repeat_purchase_rate: totalCustomers > 0 ? returningCustomers / totalCustomers : 0,
        };
    }
    async getLastAggregatedAt(filtersInput) {
        const filters = this.normalizeFilters(filtersInput);
        const [row] = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
            .max({ last_aggregated_at: 'aggregated_at' });
        return row?.last_aggregated_at ? new Date(row.last_aggregated_at).toISOString() : null;
    }
    async chart(filters, metric) {
        const periodExpression = this.knex.raw(`date_trunc(?, period_start) as period`, [
            filters.bucket === 'hourly' ? 'hour' : 'day',
        ]);
        if (metric === 'aov') {
            const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
                .select(periodExpression)
                .sum({ revenue: 'revenue', orders: 'orders' })
                .groupBy('period')
                .orderBy('period', 'asc');
            return rows.map((row) => {
                const orders = numberValue(row.orders);
                return {
                    period: row.period,
                    value: orders > 0 ? numberValue(row.revenue) / orders : 0,
                };
            });
        }
        if (metric === 'repeat_purchase_rate') {
            const rows = await this.applyFilters(this.knex('customer_metrics_daily'), filters, 'current')
                .select(periodExpression)
                .sum({
                customers_with_orders: 'customers_with_orders',
                repeat_customers: 'repeat_customers',
            })
                .groupBy('period')
                .orderBy('period', 'asc');
            return rows.map((row) => ({
                period: row.period,
                value: safeRatio(numberValue(row.repeat_customers), numberValue(row.customers_with_orders)),
            }));
        }
        const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
            .select(periodExpression)
            .sum({ value: metric })
            .groupBy('period')
            .orderBy('period', 'asc');
        return rows.map((row) => ({
            period: row.period,
            value: numberValue(row.value),
        }));
    }
    withShares(row, totals) {
        const revenue = numberValue(row.revenue);
        const orders = numberValue(row.orders);
        const unitsSold = numberValue(row.units_sold);
        return {
            revenue,
            orders,
            units_sold: unitsSold,
            revenue_share: safeRatio(revenue, totals.revenue),
            orders_share: safeRatio(orders, totals.orders),
            units_share: safeRatio(unitsSold, totals.units_sold),
            avg_unit_price: unitsSold > 0 ? revenue / unitsSold : 0,
        };
    }
    async metricTotals(filters, table) {
        const [row] = await this.applyFilters(this.knex(table), filters, 'current').sum({
            revenue: 'revenue',
            orders: 'orders',
            units_sold: 'units_sold',
        });
        return {
            revenue: numberValue(row?.revenue),
            orders: numberValue(row?.orders),
            units_sold: numberValue(row?.units_sold),
        };
    }
    async topProducts(filters, totals) {
        const rows = await this.applyFilters(this.knex('product_metrics_daily'), filters, 'current')
            .select('product_id', 'product_title', 'product_handle')
            .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
            .groupBy('product_id', 'product_title', 'product_handle')
            .orderBy('revenue', 'desc')
            .limit(10);
        return rows.map((row) => ({
            id: row.product_id,
            title: row.product_title ?? row.product_id,
            handle: row.product_handle,
            ...this.withShares(row, totals),
        }));
    }
    async topCollections(filters, totals) {
        const rows = await this.applyFilters(this.knex('collection_metrics_daily'), filters, 'current')
            .whereNotNull('collection_id')
            .select('collection_id', 'collection_title')
            .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
            .groupBy('collection_id', 'collection_title')
            .orderBy('revenue', 'desc')
            .limit(10);
        return rows.map((row) => ({
            id: row.collection_id,
            title: row.collection_title ?? row.collection_id,
            ...this.withShares(row, totals),
        }));
    }
    async topCategories(filters, totals) {
        const rows = await this.applyFilters(this.knex('collection_metrics_daily'), filters, 'current')
            .whereNotNull('category_id')
            .select('category_id', 'category_name')
            .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
            .groupBy('category_id', 'category_name')
            .orderBy('revenue', 'desc')
            .limit(10);
        return rows.map((row) => ({
            id: row.category_id,
            title: row.category_name ?? row.category_id,
            ...this.withShares(row, totals),
        }));
    }
    async customerSummary(filters, range) {
        const [row] = await this.applyFilters(this.knex('customer_metrics_daily'), filters, range).sum({
            new_customers: 'new_customers',
            returning_customers: 'returning_customers',
            customers_with_orders: 'customers_with_orders',
            repeat_customers: 'repeat_customers',
        });
        const customersWithOrders = numberValue(row?.customers_with_orders);
        const repeatCustomers = numberValue(row?.repeat_customers);
        const returningCustomers = numberValue(row?.returning_customers);
        return {
            new_customers: numberValue(row?.new_customers),
            returning_customers: returningCustomers,
            customers_with_orders: customersWithOrders,
            repeat_customers: repeatCustomers,
            repeat_purchase_rate: safeRatio(repeatCustomers, customersWithOrders),
            returning_share: safeRatio(returningCustomers, customersWithOrders),
        };
    }
    async calendar(filters) {
        if (filters.bucket === 'hourly') {
            const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
                .select(this.knex.raw('extract(dow from period_start)::int as day_of_week'), this.knex.raw('extract(hour from period_start)::int as hour'))
                .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
                .groupBy('day_of_week', 'hour')
                .orderBy('day_of_week', 'asc')
                .orderBy('hour', 'asc');
            return {
                mode: 'hourly',
                rows: rows.map((row) => ({
                    day_of_week: numberValue(row.day_of_week),
                    hour: numberValue(row.hour),
                    revenue: numberValue(row.revenue),
                    orders: numberValue(row.orders),
                    units_sold: numberValue(row.units_sold),
                })),
            };
        }
        const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
            .select(this.knex.raw('date(period_start) as date'), this.knex.raw('extract(day from period_start)::int as day_of_month'), this.knex.raw('ceil(extract(day from period_start) / 7.0)::int as week_of_month'))
            .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
            .groupBy('date', 'day_of_month', 'week_of_month')
            .orderBy('date', 'asc');
        return {
            mode: 'daily',
            rows: rows.map((row) => ({
                date: row.date,
                day_of_month: numberValue(row.day_of_month),
                week_of_month: numberValue(row.week_of_month),
                revenue: numberValue(row.revenue),
                orders: numberValue(row.orders),
                units_sold: numberValue(row.units_sold),
            })),
        };
    }
    async breakdown(filters, field) {
        const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
            .select(field)
            .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
            .groupBy(field)
            .orderBy('revenue', 'desc')
            .limit(12);
        const totals = rows.reduce((acc, row) => ({
            revenue: acc.revenue + numberValue(row.revenue),
            orders: acc.orders + numberValue(row.orders),
            units_sold: acc.units_sold + numberValue(row.units_sold),
        }), { revenue: 0, orders: 0, units_sold: 0 });
        return rows.map((row) => ({
            key: row[field] ?? 'Sin dato',
            ...this.withShares(row, totals),
        }));
    }
    async getDashboard(filtersInput) {
        const filters = this.normalizeFilters(filtersInput);
        const [current, previous, currentCustomers, previousCustomers, productTotals, collectionTotals,] = await Promise.all([
            this.commerceSummary(filters, 'current'),
            this.commerceSummary(filters, 'previous'),
            this.customerSummary(filters, 'current'),
            this.customerSummary(filters, 'previous'),
            this.metricTotals(filters, 'product_metrics_daily'),
            this.metricTotals(filters, 'collection_metrics_daily'),
        ]);
        const [revenueOverTime, ordersOverTime, unitsOverTime, aovOverTime, repeatPurchaseRateOverTime, calendar, salesChannels, countries, currencies, topProducts, topCollections, topCategories,] = await Promise.all([
            this.chart(filters, 'revenue'),
            this.chart(filters, 'orders'),
            this.chart(filters, 'units_sold'),
            this.chart(filters, 'aov'),
            this.chart(filters, 'repeat_purchase_rate'),
            this.calendar(filters),
            this.breakdown(filters, 'sales_channel_id'),
            this.breakdown(filters, 'country_code'),
            this.breakdown(filters, 'currency_code'),
            this.topProducts(filters, productTotals),
            this.topCollections(filters, collectionTotals),
            this.topCategories(filters, collectionTotals),
        ]);
        return {
            filters,
            kpis: {
                revenue: this.summary(current.revenue, previous.revenue),
                orders: this.summary(current.orders, previous.orders),
                aov: this.summary(current.aov, previous.aov),
                units_sold: this.summary(current.units_sold, previous.units_sold),
                new_customers: this.summary(current.new_customers, previous.new_customers),
                returning_customers: this.summary(current.returning_customers, previous.returning_customers),
                refunds: this.summary(current.refunds, previous.refunds),
                conversion_proxy: this.summary(current.conversion_proxy, previous.conversion_proxy),
            },
            customers: {
                new_customers: this.summary(currentCustomers.new_customers, previousCustomers.new_customers),
                returning_customers: this.summary(currentCustomers.returning_customers, previousCustomers.returning_customers),
                customers_with_orders: this.summary(currentCustomers.customers_with_orders, previousCustomers.customers_with_orders),
                repeat_customers: this.summary(currentCustomers.repeat_customers, previousCustomers.repeat_customers),
                repeat_purchase_rate: this.summary(currentCustomers.repeat_purchase_rate, previousCustomers.repeat_purchase_rate),
                returning_share: this.summary(currentCustomers.returning_share, previousCustomers.returning_share),
            },
            charts: {
                revenue_over_time: revenueOverTime,
                orders_over_time: ordersOverTime,
                units_sold_over_time: unitsOverTime,
                aov_over_time: aovOverTime,
                repeat_purchase_rate_over_time: repeatPurchaseRateOverTime,
                commercial_calendar: calendar,
            },
            breakdowns: {
                sales_channels: salesChannels,
                countries,
                currencies,
            },
            tables: {
                top_products: topProducts,
                top_collections: topCollections,
                top_categories: topCategories,
            },
            future_capabilities: {
                ai_insights: 'reserved',
                forecasting: 'reserved',
                campaign_attribution: 'reserved',
            },
        };
    }
}
exports.default = CommerceDashboardModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lcmNlLWRhc2hib2FyZC9zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscURBQTBEO0FBQzFELHFDQUtrQjtBQWtDbEIsTUFBTSxXQUFXLEdBQUcsQ0FBQyxLQUFjLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0QsTUFBTSxTQUFTLEdBQUcsQ0FBQyxLQUFhLEVBQUUsS0FBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRXBGLE1BQU0sOEJBQStCLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQ3pELG9CQUFvQixFQUFwQiw2QkFBb0I7SUFDcEIsbUJBQW1CLEVBQW5CLDRCQUFtQjtJQUNuQixzQkFBc0IsRUFBdEIsK0JBQXNCO0lBQ3RCLG9CQUFvQixFQUFwQiw2QkFBb0I7Q0FDckIsQ0FBQztJQUNBLElBQVksSUFBSTtRQUNkLE9BQVEsSUFBWSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDdkQsQ0FBQztJQUVPLGdCQUFnQixDQUFDLE9BQWlDO1FBQ3hELE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwQyxNQUFNLEVBQUUsR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFaEMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUMvRCxNQUFNLElBQUks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