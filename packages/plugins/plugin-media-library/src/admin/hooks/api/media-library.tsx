import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/media-library';

export type MediaAsset = {
  id: string;
  file_id?: string | null;
  url: string;
  filename: string;
  mime_type?: string | null;
  size?: number | null;
  alt?: string | null;
  title?: string | null;
  source?: string | null;
  created_at?: string;
};

export const MEDIA_QK = ['media-library'] as const;

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

export const MEDIA_PAGE_SIZE = 24;

export function useMediaAssets(params?: { q?: string; page?: number; limit?: number }) {
  const q = params?.q;
  const limit = params?.limit ?? MEDIA_PAGE_SIZE;
  const page = params?.page ?? 1;
  const offset = (page - 1) * limit;
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  qs.set('limit', String(limit));
  qs.set('offset', String(offset));
  return useQuery({
    queryKey: [...MEDIA_QK, q ?? '', page, limit],
    queryFn: () =>
      fetchJson<{ media_assets: MediaAsset[]; count: number; limit: number; offset: number }>(
        `${BASE_URL}?${qs}`,
      ),
  });
}

export function useRegisterAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      url: string;
      file_id?: string;
      filename: string;
      mime_type?: string;
      size?: number;
    }) => fetchJson<{ media_asset: MediaAsset }>(BASE_URL, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; filename?: string; alt?: string; title?: string }) =>
      fetchJson(`${BASE_URL}/${args.id}`, {
        method: 'POST',
        body: JSON.stringify({ filename: args.filename, alt: args.alt, title: args.title }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK }),
  });
}

export function useBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ imported: number; skipped: number; total: number }>(`${BASE_URL}/backfill`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK }),
  });
}

export function useAttachToProduct() {
  return useMutation({
    mutationFn: (args: { product_id: string; asset_ids: string[] }) =>
      fetchJson<{ added: number; total: number }>(`${BASE_URL}/attach`, {
        method: 'POST',
        body: JSON.stringify(args),
      }),
  });
}
