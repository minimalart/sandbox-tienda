import type { FetchError } from '@medusajs/js-sdk';
import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';

import { sdk } from '../../lib/client';

export type WaEvent = {
  id: string;
  phone: string;
  session_id: string | null;
  type: string;
  step: string | null;
  payload: Record<string, unknown> | null;
  used_ai: boolean;
  seq: number | null;
  created_at: string;
};

export type WaSessionSummary = {
  session_id: string;
  legacy: boolean;
  phone: string;
  started_at: string;
  last_at: string;
  events: number;
  nodes: number;
  used_ai: boolean;
  outcome: string;
};

export type WaSessionsResponse = {
  days: number;
  rows_read: number;
  truncated: boolean;
  sessions: WaSessionSummary[];
};

export type WaSessionDetail = {
  session_id: string;
  phone: string | null;
  outcome: string;
  /** Los nodos por los que pasó, en orden. Es lo que se resalta en el canvas. */
  path: string[];
  version_id: string | null;
  events: WaEvent[];
};

export const whatsappSessionsQueryKey = {
  list: (days: number) => ['whatsapp-sessions', days] as const,
  detail: (id: string) => ['whatsapp-sessions', 'detail', id] as const,
};

export const useWhatsappSessions = (
  days = 7,
  options?: UseQueryOptions<WaSessionsResponse, FetchError, WaSessionsResponse, QueryKey>,
) =>
  useQuery({
    queryKey: whatsappSessionsQueryKey.list(days),
    queryFn: () =>
      sdk.client.fetch<WaSessionsResponse>('/admin/whatsapp-sessions', {
        method: 'GET',
        query: { days },
      }),
    ...options,
  });

export const useWhatsappSession = (
  sessionId: string | null,
  options?: UseQueryOptions<WaSessionDetail, FetchError, WaSessionDetail, QueryKey>,
) =>
  useQuery({
    queryKey: whatsappSessionsQueryKey.detail(sessionId ?? ''),
    queryFn: () =>
      sdk.client.fetch<WaSessionDetail>('/admin/whatsapp-sessions', {
        method: 'GET',
        query: { session_id: sessionId },
      }),
    enabled: Boolean(sessionId),
    ...options,
  });
