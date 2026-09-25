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
import type { BranchType } from '../../../lib/branch-types';

/**
 * El id de un tipo de sucursal. Ya no es un enum: cada TIENDA define su lista
 * en `content_config.sucursales.types` y esto guarda uno de esos ids. La cadena
 * vacía es "sin tipo" — lo que corresponde a una tienda que no clasifica sus
 * sucursales. Los tipos disponibles se piden con `useBranchTypes`.
 */
export type StoreLocationType = string;

export interface BusinessHoursSlot {
  open: string;
  close: string;
}

export type BusinessHours = Record<
  string,
  {
    closed: boolean;
    is24Hours: boolean;
    slots: BusinessHoursSlot[];
    /** Optional per-day cap (used by delivery schedules; null/undefined = no cap). */
    maxPerDay?: number | null;
  }
>;

export interface StoreLocation {
  id: string;
  code: string | null;
  store_type: StoreLocationType;
  name: string;
  province: string;
  city: string;
  street: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  linkedin: string | null;
  business_hours: BusinessHours | null;
  images: string[] | null;
  is_visible: boolean;
  /**
   * Storefront visibility scope: null/[] = visible in every sales channel.
   * NOT the operational channel ownership (see BranchConfig.sales_channels).
   */
  sales_channel_ids: string[] | null;
  active: boolean;
  stock_location_id: string | null;
  delivers_kits: boolean;
  delivery_pin: number | null;
  lat: string | null;
  lng: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminStoreLocationsResponse {
  store_locations: StoreLocation[];
  count: number;
  offset: number;
  limit: number;
}

export interface AdminStoreLocationResponse {
  store_location: StoreLocation;
}

export interface AdminCreateStoreLocation {
  name: string;
  store_type: StoreLocationType;
  province: string;
  city: string;
  street: string;
  code?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  linkedin?: string | null;
  business_hours?: BusinessHours | null;
  images?: string[] | null;
  is_visible?: boolean;
  sales_channel_ids?: string[] | null;
  active?: boolean;
  delivers_kits?: boolean;
  delivery_pin?: number | null;
  lat?: string | null;
  lng?: string | null;
}

export type AdminUpdateStoreLocation = Partial<AdminCreateStoreLocation>;

// ── Branch commercial config (stock location + sales channels) ──────────────

export type ChannelType = 'b2c' | 'b2b' | 'in_person';

export interface BranchConfigChannel {
  id: string;
  name?: string;
  channel_type: ChannelType | null;
}

export interface BranchConfig {
  id: string;
  active: boolean;
  stock_location_id: string | null;
  sales_channels: BranchConfigChannel[];
}

export interface AdminBranchConfigResponse {
  branch_config: BranchConfig;
}

export interface AdminUpdateBranchConfig {
  active?: boolean;
  stock_location_id?: string | null;
  sales_channels?: { id: string; channel_type: ChannelType }[];
}

export const storeLocationQueryKey = queryKeysFactory('store-location');

export interface AdminBranchTypesResponse {
  branch_types: BranchType[];
}

/**
 * Los tipos de sucursal que ofrecen las tiendas de estos canales.
 *
 * La lista sale del backend y no de `useDemoStores` a propósito: el fallback
 * para una instalación sin la extensión `multistore` vive en el endpoint, así
 * el admin de Sucursales no tiene que saber si Tiendas existe.
 */
export const useBranchTypes = (
  salesChannelIds: string[] = [],
  options?: UseQueryOptions<AdminBranchTypesResponse, FetchError, AdminBranchTypesResponse, QueryKey>
) => {
  // Ordenados: el Select no debe refetchear porque el operador tildó los mismos
  // canales en otro orden.
  const key = [...salesChannelIds].sort().join(',');

  return useQuery({
    queryKey: ['branch-types', key],
    queryFn: async () =>
      sdk.client.fetch<AdminBranchTypesResponse>(
        `/admin/branch-types${key ? `?sales_channel_ids=${encodeURIComponent(key)}` : ''}`,
        { method: 'GET' }
      ),
    ...options,
  });
};

export const useStoreLocations = (
  query?: Record<string, any>,
  options?: UseQueryOptions<
    AdminStoreLocationsResponse,
    FetchError,
    AdminStoreLocationsResponse,
    QueryKey
  >
) => {
  const filterQuery = toQueryString(query);

  const fetchStoreLocations = async () =>
    sdk.client.fetch<AdminStoreLocationsResponse>(
      `/admin/store-locations${filterQuery ? `?${filterQuery}` : ''}`,
      { method: 'GET' }
    );

  return useQuery({
    queryKey: storeLocationQueryKey.list(query),
    queryFn: fetchStoreLocations,
    ...options,
  });
};

export const useStoreLocation = (
  storeLocationId: string,
  options?: UseQueryOptions<
    AdminStoreLocationResponse,
    FetchError,
    AdminStoreLocationResponse,
    QueryKey
  >
) => {
  const fetchStoreLocation = async () =>
    sdk.client.fetch<AdminStoreLocationResponse>(`/admin/store-locations/${storeLocationId}`, {
      method: 'GET',
    });

  return useQuery({
    queryKey: storeLocationQueryKey.detail(storeLocationId),
    queryFn: fetchStoreLocation,
    enabled: !!storeLocationId,
    ...options,
  });
};

export const useCreateStoreLocation = (
  options?: UseMutationOptions<AdminStoreLocationResponse, FetchError, AdminCreateStoreLocation>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (storeLocation: AdminCreateStoreLocation) =>
      sdk.client.fetch<AdminStoreLocationResponse>('/admin/store-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: storeLocation,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: storeLocationQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useUpdateStoreLocation = (
  storeLocationId: string,
  options?: UseMutationOptions<AdminStoreLocationResponse, FetchError, AdminUpdateStoreLocation>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (storeLocation: AdminUpdateStoreLocation) =>
      sdk.client.fetch<AdminStoreLocationResponse>(`/admin/store-locations/${storeLocationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: storeLocation,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: storeLocationQueryKey.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: storeLocationQueryKey.detail(storeLocationId),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useDeleteStoreLocation = (
  storeLocationId: string,
  options?: UseMutationOptions<void, FetchError>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: () =>
      sdk.client.fetch<void>(`/admin/store-locations/${storeLocationId}`, {
        method: 'DELETE',
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: storeLocationQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useBranchConfig = (
  storeLocationId: string,
  options?: UseQueryOptions<AdminBranchConfigResponse, FetchError, AdminBranchConfigResponse, QueryKey>
) => {
  return useQuery({
    queryKey: ['store-location', storeLocationId, 'branch-config'],
    queryFn: () =>
      sdk.client.fetch<AdminBranchConfigResponse>(
        `/admin/store-locations/${storeLocationId}/branch-config`,
        { method: 'GET' }
      ),
    enabled: !!storeLocationId,
    ...options,
  });
};

export const useUpdateBranchConfig = (
  storeLocationId: string,
  options?: UseMutationOptions<AdminBranchConfigResponse, FetchError, AdminUpdateBranchConfig>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (body: AdminUpdateBranchConfig) =>
      sdk.client.fetch<AdminBranchConfigResponse>(
        `/admin/store-locations/${storeLocationId}/branch-config`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: ['store-location', storeLocationId, 'branch-config'],
      });
      queryClient.invalidateQueries({ queryKey: storeLocationQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

/** Available Medusa sales channels (for branch association). */
export const useAdminSalesChannels = () =>
  useQuery({
    queryKey: ['admin-sales-channels'],
    queryFn: () => sdk.admin.salesChannel.list({ limit: 200 }),
  });

/** Available Medusa stock locations (for branch inventory association). */
export const useAdminStockLocations = () =>
  useQuery({
    queryKey: ['admin-stock-locations'],
    queryFn: () => sdk.admin.stockLocation.list({ limit: 200 }),
  });

// ── Branch coverage (polygons) ──────────────────────────────────────────────

export interface PolygonPoint {
  x: string;
  y: string;
}

export interface BranchCoverageItem {
  id: string;
  store_location_id: string;
  name: string;
  polygon: PolygonPoint[];
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminCoveragesResponse {
  coverages: BranchCoverageItem[];
}

export interface AdminCoverageResponse {
  coverage: BranchCoverageItem;
}

export interface AdminCreateCoverage {
  name: string;
  polygon: PolygonPoint[];
  priority?: number;
  active?: boolean;
}

export type AdminUpdateCoverage = Partial<AdminCreateCoverage>;

const coverageKey = (storeLocationId: string) => ['store-location', storeLocationId, 'coverage'];

export const useCoverages = (
  storeLocationId: string,
  options?: UseQueryOptions<AdminCoveragesResponse, FetchError, AdminCoveragesResponse, QueryKey>
) =>
  useQuery({
    queryKey: coverageKey(storeLocationId),
    queryFn: () =>
      sdk.client.fetch<AdminCoveragesResponse>(
        `/admin/store-locations/${storeLocationId}/coverage`,
        { method: 'GET' }
      ),
    enabled: !!storeLocationId,
    ...options,
  });

export const useCreateCoverage = (
  storeLocationId: string,
  options?: UseMutationOptions<AdminCoverageResponse, FetchError, AdminCreateCoverage>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (body: AdminCreateCoverage) =>
      sdk.client.fetch<AdminCoverageResponse>(
        `/admin/store-locations/${storeLocationId}/coverage`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: coverageKey(storeLocationId) });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useUpdateCoverage = (
  storeLocationId: string,
  coverageId: string,
  options?: UseMutationOptions<AdminCoverageResponse, FetchError, AdminUpdateCoverage>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (body: AdminUpdateCoverage) =>
      sdk.client.fetch<AdminCoverageResponse>(
        `/admin/store-locations/${storeLocationId}/coverage/${coverageId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: coverageKey(storeLocationId) });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useDeleteCoverage = (
  storeLocationId: string,
  coverageId: string,
  options?: UseMutationOptions<{ id: string; deleted: boolean }, FetchError>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: () =>
      sdk.client.fetch<{ id: string; deleted: boolean }>(
        `/admin/store-locations/${storeLocationId}/coverage/${coverageId}`,
        { method: 'DELETE' }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: coverageKey(storeLocationId) });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

// ── Branch delivery settings ────────────────────────────────────────────────

export interface BranchDeliveryData {
  id: string;
  store_location_id: string;
  timezone: string | null;
  lead_time_hours: number | null;
  active: boolean;
  schedules: BusinessHours | null;
  created_at: string;
  updated_at: string;
}

export interface AdminBranchDeliveryResponse {
  delivery: BranchDeliveryData | null;
}

export interface AdminUpdateBranchDelivery {
  timezone?: string | null;
  lead_time_hours?: number | null;
  active?: boolean;
  schedules?: BusinessHours | null;
}

const deliveryKey = (storeLocationId: string) => ['store-location', storeLocationId, 'delivery'];

export const useBranchDelivery = (
  storeLocationId: string,
  options?: UseQueryOptions<AdminBranchDeliveryResponse, FetchError, AdminBranchDeliveryResponse, QueryKey>
) =>
  useQuery({
    queryKey: deliveryKey(storeLocationId),
    queryFn: () =>
      sdk.client.fetch<AdminBranchDeliveryResponse>(
        `/admin/store-locations/${storeLocationId}/delivery`,
        { method: 'GET' }
      ),
    enabled: !!storeLocationId,
    ...options,
  });

export const useUpdateBranchDelivery = (
  storeLocationId: string,
  options?: UseMutationOptions<AdminBranchDeliveryResponse, FetchError, AdminUpdateBranchDelivery>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (body: AdminUpdateBranchDelivery) =>
      sdk.client.fetch<AdminBranchDeliveryResponse>(
        `/admin/store-locations/${storeLocationId}/delivery`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: deliveryKey(storeLocationId) });
      options?.onSuccess?.(data, variables, context);
    },
  });
};
