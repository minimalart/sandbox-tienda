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

export type PdfHotspotType = 'product' | 'video' | 'text';

export interface PdfCatalogHotspot {
  id?: string;
  type: PdfHotspotType;
  page_index: number;
  pos_x: number;
  pos_y: number;
  product_id?: string | null;
  variant_id?: string | null;
  data?: Record<string, unknown> | null;
  sort_order?: number;
}

export interface PdfCatalog {
  id: string;
  name: string;
  pdf_url: string;
  pdf_file_id: string | null;
  pages: number;
  published: boolean;
  metadata?: Record<string, unknown> | null;
  hotspots?: PdfCatalogHotspot[];
  sales_channel_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AdminPdfCatalogsResponse {
  pdf_catalogs: PdfCatalog[];
  count: number;
  offset: number;
  limit: number;
}

export interface AdminPdfCatalogResponse {
  pdf_catalog: PdfCatalog;
}

export interface AdminCreatePdfCatalog {
  name: string;
  pdf_url: string;
  pdf_file_id?: string | null;
  pages?: number;
  published?: boolean;
  hotspots?: PdfCatalogHotspot[];
  sales_channel_ids?: string[];
}

export type AdminUpdatePdfCatalog = Partial<AdminCreatePdfCatalog>;

export const pdfCatalogQueryKey = queryKeysFactory('pdf-catalog');

export const usePdfCatalogs = (
  query?: Record<string, any>,
  options?: UseQueryOptions<AdminPdfCatalogsResponse, FetchError, AdminPdfCatalogsResponse, QueryKey>
) => {
  const filterQuery = toQueryString(query);

  return useQuery({
    queryKey: pdfCatalogQueryKey.list(query),
    queryFn: async () =>
      sdk.client.fetch<AdminPdfCatalogsResponse>(
        `/admin/pdf-catalogs${filterQuery ? `?${filterQuery}` : ''}`,
        { method: 'GET' }
      ),
    ...options,
  });
};

export const usePdfCatalog = (
  id: string,
  options?: UseQueryOptions<AdminPdfCatalogResponse, FetchError, AdminPdfCatalogResponse, QueryKey>
) =>
  useQuery({
    queryKey: pdfCatalogQueryKey.detail(id),
    queryFn: async () =>
      sdk.client.fetch<AdminPdfCatalogResponse>(`/admin/pdf-catalogs/${id}`, {
        method: 'GET',
      }),
    enabled: !!id,
    ...options,
  });

export const useCreatePdfCatalog = (
  options?: UseMutationOptions<AdminPdfCatalogResponse, FetchError, AdminCreatePdfCatalog>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminCreatePdfCatalog) =>
      sdk.client.fetch<AdminPdfCatalogResponse>('/admin/pdf-catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useUpdatePdfCatalog = (
  id: string,
  options?: UseMutationOptions<AdminPdfCatalogResponse, FetchError, AdminUpdatePdfCatalog>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminUpdatePdfCatalog) =>
      sdk.client.fetch<AdminPdfCatalogResponse>(`/admin/pdf-catalogs/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.lists() });
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.detail(id) });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeletePdfCatalog = (
  id: string,
  options?: UseMutationOptions<void, FetchError>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<void>(`/admin/pdf-catalogs/${id}`, { method: 'DELETE' }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
