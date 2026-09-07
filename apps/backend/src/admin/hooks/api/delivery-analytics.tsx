import { useQuery } from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import type { DeliveryProviderType } from './delivery';

export type DeliveryMetricsFilters = {
  from: string;
  to: string;
  store_location_id?: string;
  provider_type?: DeliveryProviderType;
};

export type CountByKey = { key: string; count: number };
export type TimeseriesPoint = { period: string; value: number };

export type DriverRank = {
  driver_id: string;
  driver_name: string | null;
  delivered: number;
  failed_attempts: number;
};

export type ZoneRank = {
  zone_id: string;
  zone_name: string | null;
  delivered: number;
  total: number;
  delivery_rate: number;
  within_sla: number;
  sla_compliance: number | null;
};

export type DeliveryMetrics = {
  filters: {
    from: string;
    to: string;
    store_location_id: string | null;
    provider_type: string | null;
  };
  totals: {
    total: number;
    delivered: number;
    failed_terminal: number;
    canceled: number;
    in_flight: number;
    delivery_rate: number;
    failed_attempt_rate: number;
    avg_attempt_count: number;
  };
  sla: {
    avg_minutes: number | null;
    median_minutes: number | null;
    within_sla: number;
    sla_eligible: number;
    sla_compliance: number | null;
  };
  by_status: CountByKey[];
  by_provider: CountByKey[];
  by_service_mode: CountByKey[];
  timeseries: TimeseriesPoint[];
  top_drivers: DriverRank[];
  by_zone: ZoneRank[];
};

export type DeliveryMetricsResponse = {
  metrics: DeliveryMetrics;
  meta: {
    source: 'on_the_fly';
    response_time_ms: number;
  };
};

export const DELIVERY_ANALYTICS_QUERY_KEY = ['delivery-analytics'] as const;

const buildQuery = (filters: DeliveryMetricsFilters) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) qs.set(key, String(value));
  }
  return qs.toString();
};

export function useDeliveryMetrics(filters: DeliveryMetricsFilters) {
  return useQuery({
    queryKey: [...DELIVERY_ANALYTICS_QUERY_KEY, filters],
    queryFn: async () => {
      const qs = buildQuery(filters);
      return (await sdk.client.fetch(`/admin/delivery/analytics${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      })) as DeliveryMetricsResponse;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
