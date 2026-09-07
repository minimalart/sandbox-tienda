import { MedusaService } from '@medusajs/framework/utils';
import {
  CollectionMetricsDaily,
  CommerceMetricsDaily,
  CustomerMetricsDaily,
  ProductMetricsDaily,
} from './models';

export type CommerceDashboardFilters = {
  from: string;
  to: string;
  sales_channel_id?: string | null;
  country_code?: string | null;
  currency_code?: string | null;
  bucket?: 'daily' | 'hourly';
};

type MetricSummary = {
  value: number;
  previous: number;
  delta: number;
};

type DashboardRow = Record<string, any>;
type Totals = {
  revenue: number;
  orders: number;
  units_sold: number;
};
type NormalizedFilters = {
  bucket: 'daily' | 'hourly';
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  sales_channel_id: string | null;
  country_code: string | null;
  currency_code: string | null;
};

const numberValue = (value: unknown) => Number(value ?? 0);
const safeRatio = (value: number, total: number) => (total > 0 ? value / total : 0);

class CommerceDashboardModuleService extends MedusaService({
  CommerceMetricsDaily,
  ProductMetricsDaily,
  CollectionMetricsDaily,
  CustomerMetricsDaily,
}) {
  private get knex() {
    return (this as any).__container__.manager.getKnex();
  }

  private normalizeFilters(filters: CommerceDashboardFilters) {
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

  private applyFilters(query: any, filters: NormalizedFilters, range: 'current' | 'previous') {
    const from = range === 'current' ? filters.from : filters.previousFrom;
    const to = range === 'current' ? filters.to : filters.previousTo;

    query
      .where('bucket', filters.bucket)
      .where('period_start', '>=', from)
      .where('period_start', '<=', to)
      .whereNull('deleted_at');

    if (filters.sales_channel_id) query.where('sales_channel_id', filters.sales_channel_id);
    if (filters.country_code) query.where('country_code', filters.country_code);
    if (filters.currency_code) query.where('currency_code', filters.currency_code);

    return query;
  }

  private summary(current: number, previous: number): MetricSummary {
    const delta =
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    return { value: current, previous, delta };
  }

  private async commerceSummary(filters: NormalizedFilters, range: 'current' | 'previous') {
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

  async getLastAggregatedAt(filtersInput: CommerceDashboardFilters) {
    const filters = this.normalizeFilters(filtersInput);
    const [row] = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
      .max({ last_aggregated_at: 'aggregated_at' });

    return row?.last_aggregated_at ? new Date(row.last_aggregated_at).toISOString() : null;
  }

  private async chart(
    filters: NormalizedFilters,
    metric: 'revenue' | 'orders' | 'units_sold' | 'aov' | 'repeat_purchase_rate'
  ) {
    const periodExpression = this.knex.raw(`date_trunc(?, period_start) as period`, [
      filters.bucket === 'hourly' ? 'hour' : 'day',
    ]);

    if (metric === 'aov') {
      const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
        .select(periodExpression)
        .sum({ revenue: 'revenue', orders: 'orders' })
        .groupBy('period')
        .orderBy('period', 'asc');

      return rows.map((row: DashboardRow) => {
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

      return rows.map((row: DashboardRow) => ({
        period: row.period,
        value: safeRatio(numberValue(row.repeat_customers), numberValue(row.customers_with_orders)),
      }));
    }

    const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
      .select(periodExpression)
      .sum({ value: metric })
      .groupBy('period')
      .orderBy('period', 'asc');

    return rows.map((row: DashboardRow) => ({
      period: row.period,
      value: numberValue(row.value),
    }));
  }

  private withShares(row: DashboardRow, totals: Totals) {
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

  private async metricTotals(
    filters: NormalizedFilters,
    table: 'product_metrics_daily' | 'collection_metrics_daily'
  ) {
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

  private async topProducts(filters: NormalizedFilters, totals: Totals) {
    const rows = await this.applyFilters(this.knex('product_metrics_daily'), filters, 'current')
      .select('product_id', 'product_title', 'product_handle')
      .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
      .groupBy('product_id', 'product_title', 'product_handle')
      .orderBy('revenue', 'desc')
      .limit(10);

    return rows.map((row: DashboardRow) => ({
      id: row.product_id,
      title: row.product_title ?? row.product_id,
      handle: row.product_handle,
      ...this.withShares(row, totals),
    }));
  }

  private async topCollections(filters: NormalizedFilters, totals: Totals) {
    const rows = await this.applyFilters(this.knex('collection_metrics_daily'), filters, 'current')
      .whereNotNull('collection_id')
      .select('collection_id', 'collection_title')
      .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
      .groupBy('collection_id', 'collection_title')
      .orderBy('revenue', 'desc')
      .limit(10);

    return rows.map((row: DashboardRow) => ({
      id: row.collection_id,
      title: row.collection_title ?? row.collection_id,
      ...this.withShares(row, totals),
    }));
  }

  private async topCategories(filters: NormalizedFilters, totals: Totals) {
    const rows = await this.applyFilters(this.knex('collection_metrics_daily'), filters, 'current')
      .whereNotNull('category_id')
      .select('category_id', 'category_name')
      .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
      .groupBy('category_id', 'category_name')
      .orderBy('revenue', 'desc')
      .limit(10);

    return rows.map((row: DashboardRow) => ({
      id: row.category_id,
      title: row.category_name ?? row.category_id,
      ...this.withShares(row, totals),
    }));
  }

  private async customerSummary(filters: NormalizedFilters, range: 'current' | 'previous') {
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

  private async calendar(filters: NormalizedFilters) {
    if (filters.bucket === 'hourly') {
      const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
        .select(
          this.knex.raw('extract(dow from period_start)::int as day_of_week'),
          this.knex.raw('extract(hour from period_start)::int as hour')
        )
        .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
        .groupBy('day_of_week', 'hour')
        .orderBy('day_of_week', 'asc')
        .orderBy('hour', 'asc');

      return {
        mode: 'hourly',
        rows: rows.map((row: DashboardRow) => ({
          day_of_week: numberValue(row.day_of_week),
          hour: numberValue(row.hour),
          revenue: numberValue(row.revenue),
          orders: numberValue(row.orders),
          units_sold: numberValue(row.units_sold),
        })),
      };
    }

    const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
      .select(
        this.knex.raw('date(period_start) as date'),
        this.knex.raw('extract(day from period_start)::int as day_of_month'),
        this.knex.raw('ceil(extract(day from period_start) / 7.0)::int as week_of_month')
      )
      .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
      .groupBy('date', 'day_of_month', 'week_of_month')
      .orderBy('date', 'asc');

    return {
      mode: 'daily',
      rows: rows.map((row: DashboardRow) => ({
        date: row.date,
        day_of_month: numberValue(row.day_of_month),
        week_of_month: numberValue(row.week_of_month),
        revenue: numberValue(row.revenue),
        orders: numberValue(row.orders),
        units_sold: numberValue(row.units_sold),
      })),
    };
  }

  private async breakdown(
    filters: NormalizedFilters,
    field: 'sales_channel_id' | 'country_code' | 'currency_code'
  ) {
    const rows = await this.applyFilters(this.knex('commerce_metrics_daily'), filters, 'current')
      .select(field)
      .sum({ revenue: 'revenue', orders: 'orders', units_sold: 'units_sold' })
      .groupBy(field)
      .orderBy('revenue', 'desc')
      .limit(12);

    const totals = (rows as DashboardRow[]).reduce(
      (acc: Totals, row: DashboardRow) => ({
        revenue: acc.revenue + numberValue(row.revenue),
        orders: acc.orders + numberValue(row.orders),
        units_sold: acc.units_sold + numberValue(row.units_sold),
      }),
      { revenue: 0, orders: 0, units_sold: 0 }
    );

    return rows.map((row: DashboardRow) => ({
      key: row[field] ?? 'Sin dato',
      ...this.withShares(row, totals),
    }));
  }

  async getDashboard(filtersInput: CommerceDashboardFilters) {
    const filters = this.normalizeFilters(filtersInput);
    const [
      current,
      previous,
      currentCustomers,
      previousCustomers,
      productTotals,
      collectionTotals,
    ] = await Promise.all([
      this.commerceSummary(filters, 'current'),
      this.commerceSummary(filters, 'previous'),
      this.customerSummary(filters, 'current'),
      this.customerSummary(filters, 'previous'),
      this.metricTotals(filters, 'product_metrics_daily'),
      this.metricTotals(filters, 'collection_metrics_daily'),
    ]);

    const [
      revenueOverTime,
      ordersOverTime,
      unitsOverTime,
      aovOverTime,
      repeatPurchaseRateOverTime,
      calendar,
      salesChannels,
      countries,
      currencies,
      topProducts,
      topCollections,
      topCategories,
    ] = await Promise.all([
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
        returning_customers: this.summary(
          current.returning_customers,
          previous.returning_customers
        ),
        refunds: this.summary(current.refunds, previous.refunds),
        conversion_proxy: this.summary(current.conversion_proxy, previous.conversion_proxy),
      },
      customers: {
        new_customers: this.summary(
          currentCustomers.new_customers,
          previousCustomers.new_customers
        ),
        returning_customers: this.summary(
          currentCustomers.returning_customers,
          previousCustomers.returning_customers
        ),
        customers_with_orders: this.summary(
          currentCustomers.customers_with_orders,
          previousCustomers.customers_with_orders
        ),
        repeat_customers: this.summary(
          currentCustomers.repeat_customers,
          previousCustomers.repeat_customers
        ),
        repeat_purchase_rate: this.summary(
          currentCustomers.repeat_purchase_rate,
          previousCustomers.repeat_purchase_rate
        ),
        returning_share: this.summary(
          currentCustomers.returning_share,
          previousCustomers.returning_share
        ),
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

export default CommerceDashboardModuleService;
