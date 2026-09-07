import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/dynamic-groups';

export type ConditionOperator = 'gte' | 'lte' | 'eq' | 'neq' | 'in' | 'contains';

export type Condition = {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | Array<string | number>;
  days?: number;
};

export type DynamicGroup = {
  id: string;
  name: string;
  handle: string;
  description?: string | null;
  customer_group_id?: string | null;
  match: 'all' | 'any';
  conditions: Condition[];
  update_mode: 'realtime' | 'manual';
  is_active: boolean;
  last_run_at?: string | null;
  last_run_stats?: {
    evaluated?: number;
    members?: number;
    added?: number;
    removed?: number;
    at?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export type MembershipLog = {
  id: string;
  dynamic_group_id: string;
  customer_id: string;
  action: 'added' | 'removed';
  reason?: Record<string, unknown> | null;
  created_at?: string;
};

export const DYNAMIC_GROUPS_QK = ['dynamic-groups'] as const;

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

export type DynamicGroupInput = {
  name: string;
  description?: string | null;
  match?: 'all' | 'any';
  conditions?: Condition[];
  update_mode?: 'realtime' | 'manual';
  is_active?: boolean;
};

export function useDynamicGroups(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const url = qs.toString() ? `${BASE_URL}?${qs}` : BASE_URL;
  return useQuery({
    queryKey: [...DYNAMIC_GROUPS_QK, params ?? {}],
    queryFn: () =>
      fetchJson<{ dynamic_groups: DynamicGroup[]; count: number }>(url),
  });
}

export function useCreateDynamicGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DynamicGroupInput) =>
      fetchJson<{ dynamic_group: DynamicGroup }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK }),
  });
}

export function useUpdateDynamicGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<DynamicGroupInput>) =>
      fetchJson<{ dynamic_group: DynamicGroup }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK }),
  });
}

export function useDeleteDynamicGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK }),
  });
}

export function useRecalculateDynamicGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ stats: DynamicGroup['last_run_stats'] }>(
        `${BASE_URL}/${id}/recalculate`,
        { method: 'POST' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK }),
  });
}

export function useDynamicGroupLogs(id: string, enabled = true) {
  return useQuery({
    queryKey: [...DYNAMIC_GROUPS_QK, id, 'logs'],
    queryFn: () =>
      fetchJson<{ logs: MembershipLog[]; count: number }>(
        `${BASE_URL}/${id}/logs?limit=100`,
      ),
    enabled,
  });
}
