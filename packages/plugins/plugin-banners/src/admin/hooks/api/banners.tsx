import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/banners';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BannerContent = {
  title?: string;
  subtitle?: string;
  body?: string;
} | null;

export type BannerMedia = {
  url: string;
  type?: string;
  aspect_ratio?: string;
} | null;

export type BannerCta = {
  url: string;
  label?: string;
  target?: string;
} | null;

export type BannerMetadata = {
  card_color?: string | null;
  [key: string]: unknown;
} | null;

export type BannerRules = {
  sales_channel_ids?: string[];
  customer_group_ids?: string[];
  locales?: string[];
  countries?: string[];
  devices?: Array<'mobile' | 'desktop'>;
  paths?: string[];
} | null;

export type Banner = {
  id: string;
  internal_name?: string;
  handle?: string;
  type?: string;
  device_type?: string;
  placement: string;
  status: string;
  priority: number;
  content: BannerContent;
  media: BannerMedia;
  cta: BannerCta;
  rules?: BannerRules;
  metadata: BannerMetadata;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BannerCreateInput = Omit<Banner, 'id' | 'created_at' | 'updated_at'>;
export type BannerUpdateInput = Partial<BannerCreateInput>;

// ─── Query keys ───────────────────────────────────────────────────────────────

export const BANNERS_QUERY_KEY = ['banners'] as const;
export const bannerQueryKey = (id: string) => ['banners', id] as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

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

export type BannersListResponse = { banners: Banner[]; count: number };

export function useBanners(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...BANNERS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<BannersListResponse>(url),
  });
}

export function useBanner(id: string) {
  return useQuery({
    queryKey: bannerQueryKey(id),
    queryFn: () => fetchJson<{ banner: Banner }>(`${BASE_URL}/${id}`).then((d) => d.banner),
    enabled: !!id,
  });
}

export function useCreateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BannerCreateInput) =>
      fetchJson<{ banner: Banner }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.banner),
    onSuccess: () => qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY }),
  });
}

export function useUpdateBanner(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BannerUpdateInput) =>
      fetchJson<{ banner: Banner }>(`${BASE_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.banner),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    },
  });
}

export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY }),
  });
}

export function usePublishBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ banner: Banner }>(`${BASE_URL}/${id}/publish`, { method: 'POST' }).then(
        (d) => d.banner
      ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    },
  });
}

export function useUnpublishBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ banner: Banner }>(`${BASE_URL}/${id}/unpublish`, { method: 'POST' }).then(
        (d) => d.banner
      ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    },
  });
}

export function useArchiveBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ banner: Banner }>(`${BASE_URL}/${id}/archive`, { method: 'POST' }).then(
        (d) => d.banner
      ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    },
  });
}

// ─── IA (stateless: sirve para crear y editar) ─────────────────────────────────

export type GenerateBannerCopyInput = {
  brief: string;
  tone?: string;
  goal?: string;
  audience?: string;
  locale?: string;
  placement?: string;
};

export type GeneratedBannerCopy = {
  content: { title: string; subtitle: string; body: string };
  cta: { label: string; url: string };
};

/** Genera el copy (title/subtitle/body + CTA) de un banner con IA. */
export function useGenerateBannerAI() {
  return useMutation({
    mutationFn: (input: GenerateBannerCopyInput) =>
      fetchJson<GeneratedBannerCopy>(`${BASE_URL}/ai-generate`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export type GenerateBannerImageInput = {
  brief: string;
  title?: string;
  styleHint?: string;
  aspectRatio?: '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
};

/** Genera una imagen para el banner con IA y devuelve su URL (subida a S3). */
export function useGenerateBannerImageAI() {
  return useMutation({
    mutationFn: (input: GenerateBannerImageInput) =>
      fetchJson<{ image_url: string; bytes: number }>(`${BASE_URL}/ai-image`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export type ComposeBannerInput = {
  brief: string;
  tone?: string;
  goal?: string;
  audience?: string;
  locale?: string;
  placement?: string;
  styleHint?: string;
  aspectRatio?: '21:9' | '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
  /** Productos que dan contexto al copy y cuyas fotos van como referencia. */
  productIds?: string[];
};

export type ComposedBanner = {
  content: { title: string; subtitle: string; body: string };
  cta: { label: string; url: string };
  image_url: string;
  bytes: number;
  product_ids: string[];
  /** Avisos no fatales (ej: falló el copy pero sí la imagen). */
  warnings: string[];
};

/**
 * Genera el "slide" completo del banner (copy + imagen) en una sola llamada,
 * usando los productos elegidos como contexto y referencia visual.
 */
export function useComposeBannerAI() {
  return useMutation({
    mutationFn: (input: ComposeBannerInput) =>
      fetchJson<ComposedBanner>(`${BASE_URL}/ai-compose`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}
