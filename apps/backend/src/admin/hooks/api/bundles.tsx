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

export type BundleStatus = 'draft' | 'published';

export interface Bundle {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  status: BundleStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
}

export interface BundleItem {
  id: string;
  bundle_id: string;
  product_id: string;
  quantity: number;
  position: number;
  metadata: Record<string, unknown> | null;
}

export interface ListBundlesParams {
  q?: string;
  status?: BundleStatus;
  store_id?: string;
  limit?: number;
  offset?: number;
}

export interface ListBundlesResponse {
  bundles: Bundle[];
  count: number;
  offset: number;
  limit: number;
}

const BUNDLES_QUERY_KEY = 'bundles' as const;
export const bundlesQueryKeys = queryKeysFactory(BUNDLES_QUERY_KEY);

export const useBundles = (
  params?: ListBundlesParams,
  options?: Omit<UseQueryOptions<ListBundlesResponse, Error, ListBundlesResponse, QueryKey>, 'queryFn' | 'queryKey'>,
) => {
  return useQuery({
    queryKey: bundlesQueryKeys.list(params ?? {}),
    queryFn: () => {
      // toQueryString devuelve `limit=20&offset=0` SIN el `?` (mismo contrato
      // que consume store-locations). Sin prefijarlo, el path terminaba en
      // `/admin/bundleslimit=20&offset=0` y Express caía al 404 de fallback
      // porque interpretaba todo eso como path.
      const qs = toQueryString(params ?? {});
      const url = qs ? `/admin/bundles?${qs}` : '/admin/bundles';
      return sdk.client.fetch<ListBundlesResponse>(url, { method: 'GET' });
    },
    ...options,
  });
};

export const useBundle = (
  id: string | undefined,
  options?: Omit<UseQueryOptions<{ bundle: Bundle }, Error, { bundle: Bundle }, QueryKey>, 'queryFn' | 'queryKey'>,
) => {
  return useQuery({
    queryKey: bundlesQueryKeys.detail(id ?? ''),
    queryFn: () =>
      sdk.client.fetch<{ bundle: Bundle }>(`/admin/bundles/${id}`, { method: 'GET' }),
    enabled: !!id,
    ...options,
  });
};

interface CreateBundlePayload {
  title: string;
  handle: string;
  description?: string | null;
  thumbnail?: string | null;
  status?: BundleStatus;
  store_ids?: string[];
  items?: { product_id: string; quantity: number; position?: number }[];
}

export const useCreateBundle = (
  options?: UseMutationOptions<{ bundle: Bundle }, Error, CreateBundlePayload>,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      sdk.client.fetch<{ bundle: Bundle }>('/admin/bundles', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

interface UpdateBundlePayload extends Partial<Omit<CreateBundlePayload, 'handle'>> {}

export const useUpdateBundle = (
  id: string,
  options?: UseMutationOptions<{ bundle: Bundle }, Error, UpdateBundlePayload>,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      sdk.client.fetch<{ bundle: Bundle }>(`/admin/bundles/${id}`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.lists() });
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.detail(id) });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteBundle = (
  options?: UseMutationOptions<{ id: string; deleted: true }, Error, string>,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      sdk.client.fetch<{ id: string; deleted: true; object: 'bundle' }>(`/admin/bundles/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const usePublishBundle = (
  id: string,
  options?: UseMutationOptions<{ bundle: Bundle }, Error, void>,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ bundle: Bundle }>(`/admin/bundles/${id}/publish`, { method: 'POST' }),
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.lists() });
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.detail(id) });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
