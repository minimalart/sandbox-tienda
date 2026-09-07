import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';

export type CommerceDashboardFilters = {
  from: string;
  to: string;
  bucket?: 'daily' | 'hourly';
  sales_channel_id?: string;
  country_code?: string;
  currency_code?: string;
};

export type MetricSummary = {
  value: number;
  previous: number;
  delta: number;
};

export type ChartPoint = {
  period: string;
  value: number;
};

export type DailyCalendarRow = {
  date: string;
  day_of_month: number;
  week_of_month: number;
  revenue: number;
  orders: number;
  units_sold: number;
};

export type HourlyCalendarRow = {
  day_of_week: number;
  hour: number;
  revenue: number;
  orders: number;
  units_sold: number;
};

export type CommercialCalendar =
  | {
      mode: 'daily';
      rows: DailyCalendarRow[];
    }
  | {
      mode: 'hourly';
      rows: HourlyCalendarRow[];
    };

export type RankedMetric = {
  id: string;
  title: string;
  handle?: string | null;
  revenue: number;
  orders: number;
  units_sold: number;
  revenue_share: number;
  orders_share: number;
  units_share: number;
  avg_unit_price: number;
};

export type BreakdownMetric = {
  key: string;
  revenue: number;
  orders: number;
  units_sold: number;
  revenue_share: number;
  orders_share: number;
  units_share: number;
  avg_unit_price: number;
};

export type CommerceDashboard = {
  filters: CommerceDashboardFilters;
  kpis: Record<
    | 'revenue'
    | 'orders'
    | 'aov'
    | 'units_sold'
    | 'new_customers'
    | 'returning_customers'
    | 'refunds'
    | 'conversion_proxy',
    MetricSummary
  >;
  customers: Record<
    | 'new_customers'
    | 'returning_customers'
    | 'customers_with_orders'
    | 'repeat_customers'
    | 'repeat_purchase_rate'
    | 'returning_share',
    MetricSummary
  >;
  charts: {
    revenue_over_time: ChartPoint[];
    orders_over_time: ChartPoint[];
    units_sold_over_time: ChartPoint[];
    aov_over_time: ChartPoint[];
    repeat_purchase_rate_over_time: ChartPoint[];
    commercial_calendar: CommercialCalendar;
  };
  breakdowns: {
    sales_channels: BreakdownMetric[];
    countries: BreakdownMetric[];
    currencies: BreakdownMetric[];
  };
  tables: {
    top_products: RankedMetric[];
    top_collections: RankedMetric[];
    top_categories: RankedMetric[];
  };
};

export type CommerceDashboardResponse = {
  dashboard: CommerceDashboard;
  meta: {
    source: 'aggregated_snapshots';
    response_time_ms: number;
    performance_target_ms: number;
    last_aggregated_at: string | null;
  };
};

export type SalesChannel = {
  id: string;
  name: string;
};

export const COMMERCE_DASHBOARD_QUERY_KEY = ['commerce-dashboard'] as const;

const buildQuery = (filters: CommerceDashboardFilters) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) qs.set(key, value);
  }
  return qs.toString();
};

export function useCommerceDashboard(filters: CommerceDashboardFilters) {
  return useQuery({
    queryKey: [...COMMERCE_DASHBOARD_QUERY_KEY, filters],
    queryFn: async () => {
      const qs = buildQuery(filters);
      return (await sdk.client.fetch(`/admin/commerce-dashboard${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      })) as CommerceDashboardResponse;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useDashboardSalesChannels() {
  return useQuery({
    queryKey: ['commerce-dashboard', 'sales-channels'],
    queryFn: async () =>
      (await sdk.client.fetch('/admin/sales-channels?limit=100', {
        method: 'GET',
      })) as { sales_channels: SalesChannel[] },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAggregateCommerceMetrics() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CommerceDashboardFilters) => {
      const res = await fetch('/admin/commerce-dashboard/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? 'Error aggregating commerce metrics');
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: COMMERCE_DASHBOARD_QUERY_KEY }),
  });
}
