import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/contact-submissions';

/**
 * The active-tenant header MUST reach the backend on every admin request; without
 * `x-site-id`, the backend's `siteFromRequest` resolves to `allSites` and the
 * filter becomes a no-op — the inbox would mix messages from all stores and the
 * bulk actions (mark read/archived) would silently affect other tenants.
 *
 * Contract with the host: the active site id is written to `localStorage` under
 * the key `ms:active-site` by the host's tenant selector. The plugin READS from
 * that same slot to stay in sync without importing the host's admin lib.
 *
 * If the plugin runs under a single-tenant host that never populates the slot,
 * this reduces to a no-op (empty headers) — same behavior as the host's
 * `siteHeader()`.
 */
const ACTIVE_SITE_STORAGE_KEY = 'ms:active-site';
const SITE_ID_HEADER = 'x-site-id';

function siteHeader(): Record<string, string> {
  try {
    const raw = typeof globalThis !== 'undefined'
      ? (globalThis as { localStorage?: Storage }).localStorage?.getItem(ACTIVE_SITE_STORAGE_KEY)
      : null;
    if (!raw) return {};
    // Host stores JSON `{ id, slug, name }`; older shapes were bare id strings.
    try {
      const parsed = JSON.parse(raw);
      const id = typeof parsed?.id === 'string' ? parsed.id.trim() : '';
      return id ? { [SITE_ID_HEADER]: id } : {};
    } catch {
      const id = raw.trim();
      return id ? { [SITE_ID_HEADER]: id } : {};
    }
  } catch {
    return {};
  }
}

export type ContactStatus = 'new' | 'read' | 'archived';

export type ContactSubmission = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  message: string;
  status: ContactStatus;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const CONTACT_QUERY_KEY = ['contact-submissions'] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...siteHeader(),
      // Caller headers win: some uploads override Content-Type and pinning ours
      // would break them.
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export type ContactListResponse = {
  contact_submissions: ContactSubmission[];
  count: number;
  limit: number;
  offset: number;
};

export function useContactSubmissions(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...CONTACT_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<ContactListResponse>(url),
  });
}

export function useUpdateContactStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContactStatus }) =>
      fetchJson<{ contact_submission: ContactSubmission }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACT_QUERY_KEY }),
  });
}

export function useDeleteContactSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACT_QUERY_KEY }),
  });
}

/** Cambia el estado de varios contactos a la vez (en paralelo, mismo endpoint por id). */
export function useBulkUpdateContactStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ContactStatus }) => {
      await Promise.all(
        ids.map((id) =>
          fetchJson(`${BASE_URL}/${id}`, {
            method: 'POST',
            body: JSON.stringify({ status }),
          }),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACT_QUERY_KEY }),
  });
}
