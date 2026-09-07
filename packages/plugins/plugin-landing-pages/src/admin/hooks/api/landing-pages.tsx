import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/landing-pages';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LandingPageStatus = 'draft' | 'published' | 'archived';

export type LandingPageSeo = {
  title?: string;
  description?: string;
  image?: string;
  noindex?: boolean;
};

export type PuckData = {
  content: unknown[];
  root: { props?: Record<string, unknown> };
  zones?: Record<string, unknown[]>;
};

export type LandingPage = {
  id: string;
  title: string;
  slug: string;
  status: LandingPageStatus;
  description?: string | null;
  seo?: LandingPageSeo | null;
  puck_data?: PuckData | null;
  template?: string | null;
  locale?: string | null;
  sales_channel_id?: string | null;
  metadata?: Record<string, unknown> | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LandingPageCreateInput = {
  title: string;
  slug?: string;
  status?: LandingPageStatus;
  description?: string | null;
  seo?: LandingPageSeo | null;
  puck_data?: PuckData | null;
  template?: string | null;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LandingPageUpdateInput = Partial<LandingPageCreateInput>;

// ─── Query keys ───────────────────────────────────────────────────────────────

export const LANDING_PAGES_QUERY_KEY = ['landing-pages'] as const;
export const landingPageQueryKey = (id: string) =>
  ['landing-pages', id] as const;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export type LandingPagesListResponse = {
  landing_pages: LandingPage[];
  count: number;
};

export function useLandingPages(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...LANDING_PAGES_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<LandingPagesListResponse>(url),
  });
}

export function useLandingPage(id: string) {
  return useQuery({
    queryKey: landingPageQueryKey(id),
    queryFn: () =>
      fetchJson<{ landing_page: LandingPage }>(`${BASE_URL}/${id}`).then(
        (d) => d.landing_page,
      ),
    enabled: !!id,
  });
}

export function useCreateLandingPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LandingPageCreateInput) =>
      fetchJson<{ landing_page: LandingPage }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY }),
  });
}

export function useUpdateLandingPage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LandingPageUpdateInput) =>
      fetchJson<{ landing_page: LandingPage }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.landing_page),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: landingPageQueryKey(id) });
    },
  });
}

export function useDeleteLandingPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY }),
  });
}

export function usePublishLandingPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ landing_page: LandingPage }>(`${BASE_URL}/${id}/publish`, {
        method: 'POST',
      }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY }),
  });
}

export function useUnpublishLandingPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ landing_page: LandingPage }>(`${BASE_URL}/${id}/unpublish`, {
        method: 'POST',
      }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY }),
  });
}

export function useDuplicateLandingPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ landing_page: LandingPage }>(`${BASE_URL}/${id}/duplicate`, {
        method: 'POST',
      }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY }),
  });
}

// ─── AI hooks (OpenRouter, server-side) ───────────────────────────────────────

export type AiGenerateInput = {
  brief: string;
  tone?: string;
  goal?: string;
  audience?: string;
  locale?: string;
  campaign?: string;
  components?: string[];
  productContext?: string;
  mode?: 'replace' | 'append' | 'draft_only';
};

export type AiPuckResponse = {
  landing_page: LandingPage;
  puck_data: PuckData;
  saved: boolean;
};

export type AiSeoResponse = {
  landing_page: LandingPage;
  seo: LandingPageSeo;
  saved: boolean;
};

function useInvalidateLanding(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY });
    qc.invalidateQueries({ queryKey: landingPageQueryKey(id) });
  };
}

export function useGenerateLandingPageAI(id: string) {
  const invalidate = useInvalidateLanding(id);
  return useMutation({
    mutationFn: (input: AiGenerateInput) =>
      fetchJson<AiPuckResponse>(`${BASE_URL}/${id}/ai-generate`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (res) => {
      if (res.saved) invalidate();
    },
  });
}

export function useImproveLandingPageCopyAI(id: string) {
  const invalidate = useInvalidateLanding(id);
  return useMutation({
    mutationFn: (input: { instruction: string; locale?: string }) =>
      fetchJson<AiPuckResponse>(`${BASE_URL}/${id}/ai-improve-copy`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useTranslateLandingPageAI(id: string) {
  const invalidate = useInvalidateLanding(id);
  return useMutation({
    mutationFn: (input: { target_locale: string }) =>
      fetchJson<AiPuckResponse>(`${BASE_URL}/${id}/ai-translate`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export type AiImageInput = {
  blockId: string;
  styleHint?: string;
  aspectRatio?: '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
  overwrite?: boolean;
};

export type AiImageResponse = AiPuckResponse & {
  block_id: string;
  image_url: string;
  bytes: number;
  skipped: boolean;
};

export function useGenerateLandingPageImageAI(id: string) {
  const invalidate = useInvalidateLanding(id);
  return useMutation({
    mutationFn: (input: AiImageInput) =>
      fetchJson<AiImageResponse>(`${BASE_URL}/${id}/ai-image`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (res) => {
      if (res.saved) invalidate();
    },
  });
}

export function useGenerateLandingPageSeoAI(id: string) {
  const invalidate = useInvalidateLanding(id);
  return useMutation({
    mutationFn: (input: { locale?: string; keywords?: string[] }) =>
      fetchJson<AiSeoResponse>(`${BASE_URL}/${id}/ai-seo`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}
