import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { sdk } from '../../../lib/client';

export interface AnalyticsTerm {
  term: string;
  count: number;
}

export interface AnalyticsFacet {
  value: string;
  count: number;
}

interface SearchAnalyticsResponse {
  success: boolean;
  message: string;
  data?: {
    popularQueries: AnalyticsTerm[];
    queriesWithoutResults: AnalyticsTerm[];
    mostSearched: AnalyticsFacet[];
  };
}

interface InitAnalyticsResponse {
  success: boolean;
  message: string;
}

const ANALYTICS_QUERY_KEY = ['typesense', 'analytics'] as const;

export const useSearchAnalytics = () => {
  const queryClient = useQueryClient();

  const analyticsQuery = useQuery({
    queryKey: ANALYTICS_QUERY_KEY,
    queryFn: async () => {
      const result = (await sdk.client.fetch('/admin/typesense/analytics', {
        method: 'GET',
      })) as SearchAnalyticsResponse;

      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load analytics');
      }
      return result.data;
    },
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const initMutation = useMutation({
    mutationFn: async () =>
      (await sdk.client.fetch('/admin/typesense/analytics/init', {
        method: 'POST',
      })) as InitAnalyticsResponse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () =>
      (await sdk.client.fetch('/admin/typesense/analytics/reset', {
        method: 'POST',
      })) as InitAnalyticsResponse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY });
    },
  });

  const refetch = useCallback(() => analyticsQuery.refetch(), [analyticsQuery]);
  const init = useCallback(() => initMutation.mutateAsync(), [initMutation]);
  const reset = useCallback(() => resetMutation.mutateAsync(), [resetMutation]);

  return {
    popularQueries: analyticsQuery.data?.popularQueries ?? [],
    queriesWithoutResults: analyticsQuery.data?.queriesWithoutResults ?? [],
    mostSearched: analyticsQuery.data?.mostSearched ?? [],
    loading: analyticsQuery.isLoading,
    initializing: initMutation.isPending,
    resetting: resetMutation.isPending,
    error:
      analyticsQuery.error?.message ??
      initMutation.error?.message ??
      resetMutation.error?.message ??
      null,
    refetch,
    init,
    reset,
  };
};
