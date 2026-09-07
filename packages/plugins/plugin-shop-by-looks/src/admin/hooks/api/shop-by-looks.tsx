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

export type ShopByLookPlacement =
  | 'top'
  | 'after_collections'
  | 'after_featured'
  | 'before_footer';

export interface ShopByLookProduct {
  id: string;
  product_id: string;
  variant_id: string | null;
  pos_x: number;
  pos_y: number;
  sort_order: number;
}

export interface ShopByLook {
  id: string;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  image_url: string;
  image_alt: string | null;
  is_active: boolean;
  sort_order: number;
  placement: ShopByLookPlacement;
  sales_channel_ids: string[] | null;
  region_ids: string[] | null;
  metadata?: Record<string, unknown> | null;
  products?: ShopByLookProduct[];
  created_at: string;
  updated_at: string;
}

export interface AdminShopByLooksResponse {
  shop_by_looks: ShopByLook[];
  count: number;
  offset: number;
  limit: number;
}

export interface AdminShopByLookResponse {
  shop_by_look: ShopByLook;
}

export interface ShopByLookProductInput {
  product_id: string;
  variant_id?: string | null;
  pos_x?: number;
  pos_y?: number;
  sort_order?: number;
}

export interface AdminCreateShopByLook {
  title: string;
  subtitle?: string | null;
  cta_label?: string | null;
  image_url: string;
  image_alt?: string | null;
  is_active?: boolean;
  sort_order?: number;
  placement?: ShopByLookPlacement;
  sales_channel_ids?: string[] | null;
  region_ids?: string[] | null;
  products?: ShopByLookProductInput[];
}

export type AdminUpdateShopByLook = Partial<AdminCreateShopByLook>;

export const shopByLookQueryKey = queryKeysFactory('shop-by-look');

export const useShopByLooks = (
  query?: Record<string, any>,
  options?: UseQueryOptions<AdminShopByLooksResponse, FetchError, AdminShopByLooksResponse, QueryKey>
) => {
  const filterQuery = toQueryString(query);

  return useQuery({
    queryKey: shopByLookQueryKey.list(query),
    queryFn: async () =>
      sdk.client.fetch<AdminShopByLooksResponse>(
        `/admin/shop-by-looks${filterQuery ? `?${filterQuery}` : ''}`,
        { method: 'GET' }
      ),
    ...options,
  });
};

export const useShopByLook = (
  lookId: string,
  options?: UseQueryOptions<AdminShopByLookResponse, FetchError, AdminShopByLookResponse, QueryKey>
) =>
  useQuery({
    queryKey: shopByLookQueryKey.detail(lookId),
    queryFn: async () =>
      sdk.client.fetch<AdminShopByLookResponse>(`/admin/shop-by-looks/${lookId}`, {
        method: 'GET',
      }),
    enabled: !!lookId,
    ...options,
  });

export const useCreateShopByLook = (
  options?: UseMutationOptions<AdminShopByLookResponse, FetchError, AdminCreateShopByLook>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminCreateShopByLook) =>
      sdk.client.fetch<AdminShopByLookResponse>('/admin/shop-by-looks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useUpdateShopByLook = (
  lookId: string,
  options?: UseMutationOptions<AdminShopByLookResponse, FetchError, AdminUpdateShopByLook>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminUpdateShopByLook) =>
      sdk.client.fetch<AdminShopByLookResponse>(`/admin/shop-by-looks/${lookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.lists() });
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.detail(lookId) });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteShopByLook = (
  lookId: string,
  options?: UseMutationOptions<void, FetchError>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<void>(`/admin/shop-by-looks/${lookId}`, { method: 'DELETE' }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
