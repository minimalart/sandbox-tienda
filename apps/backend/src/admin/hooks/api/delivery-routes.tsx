import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
/*
  `fetchJson` compartido, NO una copia local. `admin/delivery/routes` y su `[id]`
  están declaradas `scoped`, pero la copia local mandaba sólo `Content-Type`: sin
  `x-site-id`, `siteFromRequest` resolvía `allSites` y el filtro quedaba en no-op.
  `dispatch` es lo que lo vuelve caro: despacha por id sobre la lista que devolvió
  el GET, así que la hoja de ruta de otra tienda se podía mandar a la calle desde
  la pantalla equivocada. Hermano de `delivery.tsx`, que sirve las otras ocho
  familias — se migran juntos o queda media migración por archivo.
*/
import { fetchJson } from '../../lib/http';

const BASE_URL = '/admin/delivery/routes';

export type RouteStatus =
  | 'planned'
  | 'dispatched'
  | 'in_progress'
  | 'completed'
  | 'canceled';

export type RouteStopStatus = 'pending' | 'arrived' | 'completed' | 'failed';

// M8: metadatos de la última optimización del orden de paradas.
export type RouteOptimizationMeta = {
  optimized_at: string;
  algorithm: 'nn+2opt';
  total_distance_km: number;
  original_distance_km: number;
  improvement_pct: number;
  optimized_count: number;
  unlocated_count: number;
  origin_source: 'store_location' | 'first_stop' | 'none';
};

export type Route = {
  id: string;
  code: string;
  driver_id?: string | null;
  vehicle_id?: string | null;
  store_location_id?: string | null;
  status: RouteStatus;
  planned_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  optimization_meta?: RouteOptimizationMeta | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  stop_count?: number;
};

// Parada enriquecida que devuelve el detalle (GET /routes/:id).
export type RouteStop = {
  id: string;
  route_id: string;
  delivery_execution_id: string;
  sequence: number;
  status: RouteStopStatus;
  eta?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  execution?: {
    id: string;
    status: string;
    provider_type: string;
    service_mode: string;
  } | null;
  order?: {
    id: string;
    display_id?: number | null;
    email?: string | null;
  } | null;
  address?: {
    address_1?: string | null;
    city?: string | null;
    postal_code?: string | null;
  } | null;
};

export type RouteDetail = Route & { stops: RouteStop[] };

export const ROUTES_QK = ['delivery-routes'] as const;
export const routeQK = (id: string) => ['delivery-routes', id] as const;

export type RouteListParams = {
  limit?: number;
  offset?: number;
  status?: RouteStatus;
  driver_id?: string;
  /** M10: scoping por tienda. */
  store_location_id?: string;
};

export type RouteListResponse = {
  routes: Route[];
  count: number;
  limit: number;
  offset: number;
};

export function useRoutes(params?: RouteListParams) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  if (params?.driver_id) qs.set('driver_id', params.driver_id);
  if (params?.store_location_id)
    qs.set('store_location_id', params.store_location_id);
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...ROUTES_QK, params ?? {}],
    queryFn: () => fetchJson<RouteListResponse>(url),
  });
}

export function useRoute(id: string | null) {
  return useQuery({
    queryKey: id ? routeQK(id) : ['delivery-routes', 'none'],
    queryFn: () => fetchJson<{ route: RouteDetail }>(`${BASE_URL}/${id}`),
    enabled: Boolean(id),
  });
}

export type CreateRouteInput = {
  store_location_id?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
  planned_date?: string | null;
  execution_ids?: string[];
};

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRouteInput) =>
      fetchJson<{ route: { route_id: string; code: string } }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROUTES_QK });
      qc.invalidateQueries({ queryKey: ['delivery-executions'] });
    },
  });
}

export type UpdateRouteStopsInput = {
  stops: { delivery_execution_id: string; sequence: number }[];
};

export function useUpdateRouteStops(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRouteStopsInput) =>
      fetchJson<{ route: unknown }>(`${BASE_URL}/${routeId}/stops`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routeQK(routeId) });
      qc.invalidateQueries({ queryKey: ROUTES_QK });
      qc.invalidateQueries({ queryKey: ['delivery-executions'] });
    },
  });
}

export function useDispatchRoute(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ dispatch: unknown }>(`${BASE_URL}/${routeId}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routeQK(routeId) });
      qc.invalidateQueries({ queryKey: ROUTES_QK });
      qc.invalidateQueries({ queryKey: ['delivery-executions'] });
    },
  });
}

// M8: resultado de optimizar el orden de las paradas de la ruta.
export type OptimizeRouteResult = {
  route_id: string;
  origin_source: 'store_location' | 'first_stop' | 'none';
  total_distance_km: number;
  original_distance_km: number;
  improvement_pct: number;
  optimized_count: number;
  unlocated_count: number;
  stop_count: number;
  optimization_meta: RouteOptimizationMeta;
};

export function useOptimizeRoute(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ optimization: OptimizeRouteResult }>(
        `${BASE_URL}/${routeId}/optimize`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routeQK(routeId) });
      qc.invalidateQueries({ queryKey: ROUTES_QK });
    },
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${BASE_URL}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROUTES_QK });
      qc.invalidateQueries({ queryKey: ['delivery-executions'] });
    },
  });
}
