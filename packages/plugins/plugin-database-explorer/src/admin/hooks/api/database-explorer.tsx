import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/database-explorer';

export type DatabaseExplorerColumn = {
  column_name: string;
  display_name?: string | null;
  data_type?: string | null;
  visible?: boolean | null;
  masked?: boolean | null;
  searchable?: boolean | null;
  filterable?: boolean | null;
  sortable?: boolean | null;
  sensitive?: boolean | null;
};

export type DatabaseExplorerTable = {
  table_name: string;
  display_name?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  show_in_visual?: boolean | null;
  primary_label_column?: string | null;
  default_sort_column?: string | null;
  default_sort_direction?: 'asc' | 'desc' | null;
  columns: DatabaseExplorerColumn[];
};

export type DatabaseExplorerRowsResponse = {
  table: DatabaseExplorerTable;
  rows: Array<Record<string, unknown>>;
  count: number;
  limit: number;
  offset: number;
};

export type DatabaseExplorerRelation = {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  relation_type: string;
  display_name?: string | null;
  inferred: boolean;
};

export type DatabaseExplorerSavedView = {
  id: string;
  name: string;
  description?: string | null;
  table_name: string;
  filters_json?: Record<string, unknown> | null;
  sort_json?: { column?: string; direction?: string } | null;
};

export type DatabaseExplorerAuditLog = {
  id: string;
  user_id?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  view_id?: string | null;
  filters_json?: Record<string, unknown> | null;
  duration_ms?: number | null;
  success: boolean;
  error_message?: string | null;
  created_at?: string;
};

export type DatabaseExplorerSettingsTable = {
  table_name: string;
  configured: boolean;
  enabled: boolean;
  columns: Array<{ column_name: string; data_type: string }>;
};

export const DATABASE_EXPLORER_QK = ['database-explorer'] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function useDatabaseExplorerTables(params?: { includeDisabled?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.includeDisabled) qs.set('include_disabled', 'true');
  const suffix = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, 'tables', params?.includeDisabled ?? false],
    queryFn: () => fetchJson<{ tables: DatabaseExplorerTable[] }>(`${BASE_URL}/tables${suffix}`),
  });
}

export function useDatabaseExplorerRows(args: {
  table?: string | null;
  page: number;
  limit: number;
  q?: string;
  sort?: string | null;
  direction?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}) {
  const qs = new URLSearchParams();
  qs.set('limit', String(args.limit));
  qs.set('offset', String(args.page * args.limit));
  if (args.q) qs.set('q', args.q);
  if (args.sort) qs.set('sort', args.sort);
  if (args.direction) qs.set('direction', args.direction);
  if (args.filters && Object.keys(args.filters).length) {
    qs.set('filters', JSON.stringify(args.filters));
  }

  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, 'rows', args.table, args.page, args.limit, args.q, args.sort, args.direction, args.filters ?? {}],
    queryFn: () =>
      fetchJson<DatabaseExplorerRowsResponse>(
        `${BASE_URL}/tables/${args.table}/rows?${qs}`
      ),
    enabled: !!args.table,
  });
}

export function useDatabaseExplorerRow(table?: string | null, id?: string | null) {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, 'row', table, id],
    queryFn: () =>
      fetchJson<{ table: DatabaseExplorerTable; row: Record<string, unknown> }>(
        `${BASE_URL}/tables/${table}/rows/${id}`
      ),
    enabled: !!table && !!id,
  });
}

export function useDatabaseExplorerGraph() {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, 'graph'],
    queryFn: () =>
      fetchJson<{
        graph: {
          nodes: Array<{
            id: string;
            label: string;
            table_name: string;
            description?: string | null;
            fields: Array<{ column_name: string; data_type?: string | null; masked: boolean }>;
            has_sensitive_fields: boolean;
          }>;
          edges: DatabaseExplorerRelation[];
        };
      }>(`${BASE_URL}/schema-graph`),
  });
}

export function useDatabaseExplorerViews() {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, 'views'],
    queryFn: () => fetchJson<{ views: DatabaseExplorerSavedView[] }>(`${BASE_URL}/views`),
  });
}

export function useRunDatabaseExplorerView(viewId?: string | null) {
  return useMutation({
    mutationFn: (params: { q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      qs.set('limit', String(params.limit ?? 25));
      qs.set('offset', String(params.offset ?? 0));
      if (params.q) qs.set('q', params.q);
      return fetchJson<DatabaseExplorerRowsResponse & { view: DatabaseExplorerSavedView }>(
        `${BASE_URL}/views/${viewId}/run?${qs}`
      );
    },
  });
}

export function useDatabaseExplorerAudit(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  qs.set('limit', String(params?.limit ?? 50));
  qs.set('offset', String(params?.offset ?? 0));
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, 'audit', params ?? {}],
    queryFn: () =>
      fetchJson<{
        audit_logs: DatabaseExplorerAuditLog[];
        count: number;
        limit: number;
        offset: number;
      }>(`${BASE_URL}/audit?${qs}`),
  });
}

export function useDatabaseExplorerSettingsTables() {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, 'settings-tables'],
    queryFn: () =>
      fetchJson<{ tables: DatabaseExplorerSettingsTable[] }>(
        `${BASE_URL}/settings/tables`
      ),
  });
}

export function useSaveDatabaseExplorerTableSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<DatabaseExplorerTable> & { table_name: string }) =>
      fetchJson<{ table: DatabaseExplorerTable }>(`${BASE_URL}/settings/tables`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DATABASE_EXPLORER_QK }),
  });
}

export function useSaveDatabaseExplorerColumnSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DatabaseExplorerColumn & { table_name: string }) =>
      fetchJson<{ column: DatabaseExplorerColumn }>(`${BASE_URL}/settings/columns`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DATABASE_EXPLORER_QK }),
  });
}
