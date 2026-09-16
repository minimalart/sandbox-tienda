import { FetchError } from '@medusajs/js-sdk';
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import { queryKeysFactory } from '../../lib/query-key-factory';
import { toQueryString } from '../../lib/query-string';

export interface MinimumPurchase {
  id: string;
  amount: number;
  currency_code: string;
  starts_at: string;
  ends_at: string | null;
  note: string | null;
  /** `null` = fila GLOBAL, la que hereda toda tienda sin serie propia. */
  site_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminMinimumPurchasesResponse {
  minimum_purchases: MinimumPurchase[];
  count: number;
  limit: number;
  offset: number;
}

export interface AdminMinimumPurchaseResponse {
  minimum_purchase: MinimumPurchase;
}

export interface AdminCreateMinimumPurchase {
  amount: number;
  currency_code?: string;
  starts_at: string;
  ends_at?: string | null;
  note?: string | null;
}

export const minimumPurchaseQueryKey = queryKeysFactory('minimum-purchase');

export const useMinimumPurchases = (
  query?: Record<string, any>,
  options?: UseQueryOptions<
    AdminMinimumPurchasesResponse,
    FetchError,
    AdminMinimumPurchasesResponse,
    QueryKey
  >
) => {
  const filterQuery = toQueryString(query);

  const fetchMinimumPurchases = async () =>
    sdk.client.fetch<AdminMinimumPurchasesResponse>(
      `/admin/store-config/minimum-purchase${filterQuery ? `?${filterQuery}` : ''}`,
      { method: 'GET' }
    );

  return useQuery({
    queryKey: minimumPurchaseQueryKey.list(query),
    queryFn: fetchMinimumPurchases,
    ...options,
  });
};

export const useCreateMinimumPurchase = (
  options?: UseMutationOptions<AdminMinimumPurchaseResponse, FetchError, AdminCreateMinimumPurchase>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminCreateMinimumPurchase) =>
      sdk.client.fetch<AdminMinimumPurchaseResponse>('/admin/store-config/minimum-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: minimumPurchaseQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

/** Todos opcionales: la ruta mergea sobre la fila guardada. `ends_at: null` la deja sin fin. */
export interface AdminUpdateMinimumPurchase {
  id: string;
  amount?: number;
  currency_code?: string;
  starts_at?: string;
  ends_at?: string | null;
  note?: string | null;
}

export const useUpdateMinimumPurchase = (
  options?: UseMutationOptions<AdminMinimumPurchaseResponse, FetchError, AdminUpdateMinimumPurchase>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: AdminUpdateMinimumPurchase) =>
      sdk.client.fetch<AdminMinimumPurchaseResponse>(
        `/admin/store-config/minimum-purchase/${encodeURIComponent(id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
        }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: minimumPurchaseQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export interface AdminDeleteMinimumPurchaseResponse {
  id: string;
  object: 'minimum_purchase';
  deleted: boolean;
}

export const useDeleteMinimumPurchase = (
  options?: UseMutationOptions<AdminDeleteMinimumPurchaseResponse, FetchError, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<AdminDeleteMinimumPurchaseResponse>(
        `/admin/store-config/minimum-purchase/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: minimumPurchaseQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

// ── Store settings (toggles: multi-branch, etc.) ────────────────────────────

export interface StoreSettings {
  multi_branch_enabled: boolean;
  require_branch_coverage: boolean;
  branch_gate_prompt_enabled: boolean;
  barcode_scanner_enabled: boolean;
  shop_by_look_enabled: boolean;
  pdf_catalog_enabled: boolean;
  cookie_banner_enabled: boolean;
}

export interface AdminStoreSettingsResponse {
  settings: StoreSettings;
}

const storeSettingsQueryKey = ['admin-store-settings'];

export const useStoreSettings = (
  options?: UseQueryOptions<AdminStoreSettingsResponse, FetchError, AdminStoreSettingsResponse, QueryKey>
) =>
  useQuery({
    queryKey: storeSettingsQueryKey,
    queryFn: () =>
      sdk.client.fetch<AdminStoreSettingsResponse>('/admin/store-config/settings', {
        method: 'GET',
      }),
    ...options,
  });

export const useUpdateStoreSettings = (
  options?: UseMutationOptions<AdminStoreSettingsResponse, FetchError, Partial<StoreSettings>>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<StoreSettings>) =>
      sdk.client.fetch<AdminStoreSettingsResponse>('/admin/store-config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: storeSettingsQueryKey });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

// ── Página de contraseña (site gate) por sitio ──────────────────────────────

export interface SiteGateSite {
  /** `store` para la tienda principal, `demo:{slug}` para una demo. */
  scope: string;
  label: string;
  enabled: boolean;
  password: string;
  /** Ruta pública donde aplica el gate (`/` o `/demo/{slug}`). */
  path: string;
  public_url?: string;
  demo_id?: string;
}

export interface AdminSiteGatesResponse {
  sites: SiteGateSite[];
}

export interface AdminSiteGateResponse {
  site: SiteGateSite;
}

export interface UpdateSiteGateInput {
  scope: string;
  enabled?: boolean;
  password?: string;
}

const siteGatesQueryKey = ['admin-site-gates'];

export const useSiteGates = (
  options?: UseQueryOptions<AdminSiteGatesResponse, FetchError, AdminSiteGatesResponse, QueryKey>
) =>
  useQuery({
    queryKey: siteGatesQueryKey,
    queryFn: () =>
      sdk.client.fetch<AdminSiteGatesResponse>('/admin/store-config/site-gate', {
        method: 'GET',
      }),
    ...options,
  });

export const useUpdateSiteGate = (
  options?: UseMutationOptions<AdminSiteGateResponse, FetchError, UpdateSiteGateInput>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSiteGateInput) =>
      sdk.client.fetch<AdminSiteGateResponse>('/admin/store-config/site-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: siteGatesQueryKey });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

// ── AI config (modelos / parámetros de IA, antes en env) ────────────────────

export interface AiConfig {
  text_model: string;
  text_max_retries: number;
  chat_model: string;
  chat_reasoning_effort: 'minimal' | 'low' | 'medium' | 'high';
  chat_max_tokens: number;
  chat_validation_enabled: boolean;
  image_model: string;
  image_quality: number;
  image_max_kb: number;
  memory_enabled: boolean;
  memory_autocapture_enabled: boolean;
  memory_autocapture_requires_approval: boolean;
  memory_retrieval_topk: number;
  memory_min_similarity: number;
  embeddings_model: string;
}

export interface AdminAiConfigResponse {
  ai_config: AiConfig;
}

const aiConfigQueryKey = ['admin-ai-config'];

export const useAiConfig = (
  options?: UseQueryOptions<AdminAiConfigResponse, FetchError, AdminAiConfigResponse, QueryKey>
) =>
  useQuery({
    queryKey: aiConfigQueryKey,
    queryFn: () =>
      sdk.client.fetch<AdminAiConfigResponse>('/admin/store-config/ai-config', {
        method: 'GET',
      }),
    ...options,
  });

export const useUpdateAiConfig = (
  options?: UseMutationOptions<AdminAiConfigResponse, FetchError, Partial<AiConfig>>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AiConfig>) =>
      sdk.client.fetch<AdminAiConfigResponse>('/admin/store-config/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: aiConfigQueryKey });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

/**
 * Returns the minimum purchase that is effective RIGHT NOW, computed from the
 * append-only history: starts_at <= now AND (ends_at null OR ends_at >= now),
 * most recent starts_at wins (ties: created_at DESC).
 */
export const getCurrentMinimumPurchase = (
  records: MinimumPurchase[],
  now: Date = new Date()
): MinimumPurchase | null => {
  const effective = records.filter((r) => {
    const startsAt = new Date(r.starts_at);
    const endsAt = r.ends_at ? new Date(r.ends_at) : null;
    return startsAt <= now && (!endsAt || endsAt >= now);
  });

  if (effective.length === 0) {
    return null;
  }

  effective.sort((a, b) => {
    const byStart = new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    if (byStart !== 0) return byStart;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return effective[0] ?? null;
};
