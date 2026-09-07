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

export interface Brand {
  id: string;
  name: string;
  handle: string;
  description?: string;
  is_active: boolean;
  sales_channel_ids?: string[] | null;
  metadata?: Record<string, unknown>;
  images?: BrandImage[];
  created_at: string;
  updated_at: string;
}

export interface BrandImage {
  id: string;
  brand_id: string;
  type: 'thumbnail' | 'image';
  url: string;
  file_id: string;
  created_at: string;
  updated_at: string;
}

export interface AdminBrandsResponse {
  brands: Brand[];
  count: number;
  offset: number;
  limit: number;
}

export interface AdminBrandResponse {
  brand: Brand;
}

export interface AdminCreateBrand {
  name: string;
  handle: string;
  description?: string;
  is_active?: boolean;
  sales_channel_ids?: string[] | null;
  metadata?: Record<string, unknown>;
}

export interface AdminUpdateBrand {
  name?: string;
  handle?: string;
  description?: string;
  is_active?: boolean;
  sales_channel_ids?: string[] | null;
  metadata?: Record<string, unknown>;
}

export interface AdminCreateBrandImages {
  images: Array<{
    type: 'thumbnail' | 'image';
    url: string;
    file_id: string;
  }>;
}

export const brandQueryKey = queryKeysFactory('brand');

export const useBrands = (
  query?: Record<string, any>,
  options?: UseQueryOptions<AdminBrandsResponse, FetchError, AdminBrandsResponse, QueryKey>
) => {
  const filterQuery = toQueryString(query);

  const fetchBrands = async () =>
    sdk.client.fetch<AdminBrandsResponse>(`/admin/brands${filterQuery ? `?${filterQuery}` : ''}`, {
      method: 'GET',
    });

  return useQuery({
    queryKey: brandQueryKey.list(query),
    queryFn: fetchBrands,
    ...options,
  });
};

export const useBrand = (
  brandId: string,
  query?: Record<string, any>,
  options?: UseQueryOptions<AdminBrandResponse, FetchError, AdminBrandResponse, QueryKey>
) => {
  const filterQuery = toQueryString(query);

  const fetchBrand = async () =>
    sdk.client.fetch<AdminBrandResponse>(
      `/admin/brands/${brandId}${filterQuery ? `?${filterQuery}` : ''}`,
      {
        method: 'GET',
      }
    );

  return useQuery({
    queryKey: brandQueryKey.detail(brandId),
    queryFn: fetchBrand,
    enabled: !!brandId,
    ...options,
  });
};

export const useCreateBrand = (
  options?: UseMutationOptions<AdminBrandResponse, FetchError, AdminCreateBrand>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (brand: AdminCreateBrand) =>
      sdk.client.fetch<AdminBrandResponse>('/admin/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: brand,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useUpdateBrand = (
  brandId: string,
  options?: UseMutationOptions<AdminBrandResponse, FetchError, AdminUpdateBrand>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (brand: AdminUpdateBrand) =>
      sdk.client.fetch<AdminBrandResponse>(`/admin/brands/${brandId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: brand,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.detail(brandId),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteBrand = (brandId: string, options?: UseMutationOptions<void, FetchError>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<void>(`/admin/brands/${brandId}`, {
        method: 'DELETE',
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useBrandImages = (
  brandId: string,
  options?: UseQueryOptions<
    { images: BrandImage[] },
    FetchError,
    { images: BrandImage[] },
    QueryKey
  >
) => {
  const fetchImages = async () =>
    sdk.client.fetch<{ images: BrandImage[] }>(`/admin/brands/${brandId}/images`, {
      method: 'GET',
    });

  return useQuery({
    queryKey: [...brandQueryKey.detail(brandId), 'images'],
    queryFn: fetchImages,
    enabled: !!brandId,
    ...options,
  });
};

export const useCreateBrandImages = (
  brandId: string,
  options?: UseMutationOptions<{ images: BrandImage[] }, FetchError, AdminCreateBrandImages>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminCreateBrandImages) =>
      sdk.client.fetch<{ images: BrandImage[] }>(`/admin/brands/${brandId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.detail(brandId),
      });
      queryClient.invalidateQueries({
        queryKey: [...brandQueryKey.detail(brandId), 'images'],
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteBrandImage = (
  brandId: string,
  options?: UseMutationOptions<{ success: boolean; deleted_id: string }, FetchError, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) =>
      sdk.client.fetch<{ success: boolean; deleted_id: string }>(
        `/admin/brands/${brandId}/images/${imageId}`,
        {
          method: 'DELETE',
        }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.detail(brandId),
      });
      queryClient.invalidateQueries({
        queryKey: [...brandQueryKey.detail(brandId), 'images'],
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
