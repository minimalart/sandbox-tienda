import type { FetchError } from '@medusajs/js-sdk';
import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { toQueryString } from '../../lib/query-string';
import type {
  TypesenseSyncLogItemRow,
  TypesenseSyncLogRow,
  TypesenseSyncMode,
  TypesenseSyncStatus,
} from '../../../modules/typesense/types';
import { sdk } from '../../lib/client';

interface TypesenseTestResponse {
  success: boolean;
  collection: string;
  documentCount: number;
  sampleProducts: any[];
  message?: string;
}

export type TypesenseSyncProgress = {
  stage:
    | 'idle'
    | 'loading'
    | 'mapping'
    | 'listing'
    | 'recreating'
    | 'upserting'
    | 'deleting'
    | 'done'
    | 'error';
  done: number;
  total: number;
  message?: string;
  startedAt?: string;
  updatedAt: string;
  sync_log_id?: string;
  status?: TypesenseSyncStatus;
  mode?: TypesenseSyncMode;
};

export const TYPESENSE_SYNC_LOGS_QUERY_KEY = ['typesense', 'sync-logs'] as const;

/**
 * Dispara la sincronización. Responde 202 con el `sync_log_id` (la corrida sigue
 * sola en el backend), así que la UI NO puede usar `isPending` como señal de
 * "está corriendo": eso lo dice el status de la última fila de log.
 */
export const useTypesenseSyncProducts = (
  options?: UseMutationOptions<
    { sync_log_id: string; mode: TypesenseSyncMode },
    FetchError,
    { mode: TypesenseSyncMode } | void
  >
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars) =>
      sdk.client.fetch<{ sync_log_id: string; mode: TypesenseSyncMode }>('/admin/typesense/sync', {
        method: 'POST',
        body: { mode: vars?.mode ?? 'update' },
      }),
    ...options,
    onSuccess: (data, vars, ctx) => {
      queryClient.invalidateQueries({ queryKey: TYPESENSE_SYNC_LOGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['typesense-sync-progress'] });
      options?.onSuccess?.(data, vars, ctx);
    },
  });
};

/**
 * Progreso de la corrida más reciente, leído de la DB (no de un singleton del
 * proceso): sobrevive a los restarts, es correcto con varios contenedores y
 * permite re-engancharse a una corrida en curso al reabrir la pantalla.
 */
export const useTypesenseSyncProgress = (enabled = true) => {
  return useQuery({
    queryKey: ['typesense-sync-progress'],
    queryFn: async () =>
      sdk.client.fetch<TypesenseSyncProgress>('/admin/typesense/sync', {
        method: 'GET',
      }),
    enabled,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
};

// ─── Historial de corridas ────────────────────────────────────────────────────

type QueryOpts = { enabled?: boolean; refetchInterval?: number | false };

export const useTypesenseSyncLogs = (
  params?: { mode?: string; status?: string; limit?: number; offset?: number },
  opts?: QueryOpts
) => {
  // `toQueryString` filtra los undefined: interpolarlos manda el literal
  // "undefined" al backend y el listado sale vacío (ver admin-hooks-query-string).
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  return useQuery({
    queryKey: [...TYPESENSE_SYNC_LOGS_QUERY_KEY, params ?? {}],
    queryFn: async () =>
      sdk.client.fetch<{ sync_logs: TypesenseSyncLogRow[]; count: number }>(
        `/admin/typesense/sync-logs${qs ? `?${qs}` : ''}`,
        { method: 'GET' }
      ),
    ...opts,
  });
};

export const useTypesenseSyncLog = (id: string | undefined, opts?: QueryOpts) => {
  return useQuery({
    queryKey: [...TYPESENSE_SYNC_LOGS_QUERY_KEY, id],
    queryFn: async () =>
      sdk.client.fetch<{ sync_log: TypesenseSyncLogRow }>(`/admin/typesense/sync-logs/${id}`, {
        method: 'GET',
      }),
    enabled: Boolean(id) && (opts?.enabled ?? true),
    refetchInterval: opts?.refetchInterval,
  });
};

export const useTypesenseSyncLogItems = (
  id: string | undefined,
  params?: { status?: string; entity_id?: string; limit?: number; offset?: number },
  opts?: QueryOpts
) => {
  const qs = toQueryString(params as Record<string, unknown> | undefined);
  return useQuery({
    queryKey: [...TYPESENSE_SYNC_LOGS_QUERY_KEY, id, 'items', params ?? {}],
    queryFn: async () =>
      sdk.client.fetch<{ items: TypesenseSyncLogItemRow[]; count: number }>(
        `/admin/typesense/sync-logs/${id}/items${qs ? `?${qs}` : ''}`,
        { method: 'GET' }
      ),
    enabled: Boolean(id) && (opts?.enabled ?? true),
    refetchInterval: opts?.refetchInterval,
  });
};

export const useTypesenseTestCollection = (
  options?: UseMutationOptions<TypesenseTestResponse, FetchError, void>
) => {
  return useMutation({
    mutationFn: async () =>
      sdk.client.fetch<TypesenseTestResponse>('/admin/typesense/test', {
        method: 'GET',
      }),
    ...options,
  });
};

export interface TypesenseConfigResponse {
  host: string;
  port: number;
  protocol: string;
  collection: string;
  apiKeySet: boolean;
  connected: boolean;
  documentCount: number | null;
}

/** Real runtime Typesense connection status (host/api-key/connected). */
export const useTypesenseConfig = () => {
  return useQuery({
    queryKey: ['typesense', 'config'],
    queryFn: async () =>
      sdk.client.fetch<TypesenseConfigResponse>('/admin/typesense/config', {
        method: 'GET',
      }),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
};

interface TypesenseLastSyncResponse {
  success: boolean;
  lastSyncAt: string | null;
}

export const TYPESENSE_LAST_SYNC_QUERY_KEY = ['typesense', 'last-sync'] as const;

export const useTypesenseLastSync = () => {
  return useQuery({
    queryKey: TYPESENSE_LAST_SYNC_QUERY_KEY,
    queryFn: async () =>
      sdk.client.fetch<TypesenseLastSyncResponse>('/admin/typesense/last-sync', {
        method: 'GET',
      }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
