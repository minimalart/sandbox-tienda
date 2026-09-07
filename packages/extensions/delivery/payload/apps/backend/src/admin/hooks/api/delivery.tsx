import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
/*
  `fetchJson` compartido, NO una copia local. Este es el archivo de mayor alcance de
  la migración: un solo helper servía OCHO familias de rutas declaradas `scoped`
  —`executions`, `drivers`, `vehicles`, `zones`, `zones/conflicts`, `rules`,
  `coverages-overview` y `routes`— y mandaba sólo `Content-Type`. Sin `x-site-id`,
  `siteFromRequest` resolvía `allSites` y el filtro del backend quedaba en no-op en
  las ocho a la vez.

  En logística eso no se queda en la pantalla. `drivers` filtra por tienda
  (`siteFilter(..., DRIVER_SITE_SCOPE)`), y es la lista de la que el operador elige
  a quién asignarle un reparto con `assign`: sin el header le ofrecíamos choferes de
  otra tienda, y la asignación se guardaba sin un solo error.

  `zones/conflicts` es el otro caso feo: el detector de solapamientos comparaba
  polígonos de las tres tiendas, así que reportaba conflictos entre zonas que nunca
  compiten y el operador aprendía a ignorarlo.

  Ojo con `executions/[id]/auto-assign`: NO invoca `siteFromRequest` —a diferencia
  de su hermana `eligible-resources`, que sí hace `assertIdInSite`— así que su pool
  de candidatos sigue sin filtrar del lado del servidor. El header ya le llega; el
  agujero es del backend y se arregla ahí, no acá.

  `admin/delivery/routes/auto-build` no tiene entrada propia en el registro y cae
  bajo `admin/delivery/routes`, que sí es `scoped`; va por el mismo helper.
  `analytics` vive en `delivery-analytics.tsx` y ya iba por el SDK.

  No hay ninguna llamada de blob, upload o descarga en este archivo — se buscaron
  explícitamente. Las pruebas de entrega (`executions/[id]/proofs`) se leen como
  JSON con URLs adentro; el binario lo sube `media-library`, que es de la instancia
  a propósito. Si mañana aparece una descarga acá, va con `siteHeaders` a mano.
*/
import { fetchJson } from '../../lib/http';

const BASE_URL = '/admin/delivery/executions';

export type DeliveryStatus =
  | 'pending'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'at_pickup_point'
  | 'delivered'
  | 'failed_attempt'
  | 'canceled';

export type DeliveryProviderType = 'andreani' | 'own_fleet' | 'store_pickup';

export type DeliveryServiceMode =
  | 'home_delivery'
  | 'hop'
  | 'branch_pickup'
  | 'store_pickup';

// Datos linkeados de solo-lectura (resueltos en vivo vía query.graph en la API).
export type LinkedOrder = {
  id: string;
  display_id?: number | null;
  email?: string | null;
};

export type LinkedFulfillment = {
  id: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  canceled_at?: string | null;
};

export type DeliveryExecution = {
  id: string;
  provider_type: DeliveryProviderType;
  service_mode: DeliveryServiceMode;
  status: DeliveryStatus;
  external_shipment_id?: string | null;
  tracking_number?: string | null;
  label_url?: string | null;
  assigned_at?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  attempt_count?: number;
  scheduled_window?: Record<string, unknown> | null;
  delivery_zone_id?: string | null;
  store_location_id?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
  route_id?: string | null;
  last_event_at?: string | null;
  created_at?: string;
  updated_at?: string;
  order?: LinkedOrder | null;
  fulfillment?: LinkedFulfillment | null;
};

export type DriverStatus = 'available' | 'on_route' | 'offline';
export type VehicleType = 'motorcycle' | 'van' | 'truck' | 'car';

// Modos de temperatura soportados por un vehículo (compatibilidad de frío, F7).
export type TemperatureMode = 'ambient' | 'refrigerated' | 'frozen';

export type Driver = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  status: DriverStatus;
  store_location_id?: string | null;
  user_id?: string | null;
  /** F7 — tope de entregas activas simultáneas (null = sin tope). */
  max_active_deliveries?: number | null;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type Vehicle = {
  id: string;
  plate: string;
  type: VehicleType;
  capacity_kg?: number | null;
  capacity_m3?: number | null;
  driver_id?: string | null;
  /** Sucursales en las que opera (multi-sucursal). */
  store_location_ids?: string[] | null;
  /** F7 — capacidad de frío. */
  has_refrigeration?: boolean;
  /** F7 — tope de órdenes por viaje (null = sin tope). */
  max_orders?: number | null;
  /** F7 — modos de temperatura soportados (null = no declarado). */
  temperature_modes?: TemperatureMode[] | null;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export const DELIVERY_EXECUTIONS_QUERY_KEY = ['delivery-executions'] as const;

export type DeliveryExecutionListParams = {
  limit?: number;
  offset?: number;
  status?: DeliveryStatus;
  provider_type?: DeliveryProviderType;
  /** M10: scoping por tienda (columna directa store_location_id). */
  store_location_id?: string;
  /** M7: solo ejecuciones sin ruta (para el armado del Route Planner). */
  unrouted?: boolean;
};

export type DeliveryExecutionListResponse = {
  delivery_executions: DeliveryExecution[];
  count: number;
  limit: number;
  offset: number;
};

// --- Detalle de ejecución ---
//
// Shapes adicionales que SOLO devuelve el endpoint de detalle (GET :id), donde
// resolvemos en vivo la dirección de envío y los datos de asignación (driver /
// vehículo / zona) que son FK lógicas del mismo módulo.

export type LinkedShippingAddress = {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
};

export type LinkedOrderDetail = LinkedOrder & {
  shipping_address?: LinkedShippingAddress | null;
};

export type AssignedDriver = {
  id: string;
  name: string;
  phone?: string | null;
  status?: DriverStatus | null;
};

export type AssignedVehicle = {
  id: string;
  plate: string;
  type?: VehicleType | null;
};

export type AssignedZone = {
  id: string;
  name: string;
};

export type DeliveryExecutionDetail = Omit<DeliveryExecution, 'order'> & {
  order?: LinkedOrderDetail | null;
  driver?: AssignedDriver | null;
  vehicle?: AssignedVehicle | null;
  zone?: AssignedZone | null;
};

export function useDeliveryExecution(id: string | undefined) {
  return useQuery({
    queryKey: [...DELIVERY_EXECUTIONS_QUERY_KEY, 'detail', id],
    queryFn: () =>
      fetchJson<{ delivery_execution: DeliveryExecutionDetail }>(
        `${BASE_URL}/${id}`,
      ),
    enabled: !!id,
  });
}

// --- Timeline de eventos ---

export type TrackingEventSource = 'andreani' | 'driver' | 'system';

export type TrackingEvent = {
  id: string;
  source: TrackingEventSource | string;
  code: string;
  description?: string | null;
  occurred_at: string;
  location?: { lat?: number; lng?: number } | null;
};

export function useDeliveryExecutionEvents(id: string | undefined) {
  return useQuery({
    queryKey: [...DELIVERY_EXECUTIONS_QUERY_KEY, 'events', id],
    queryFn: () =>
      fetchJson<{ events: TrackingEvent[]; count: number }>(
        `${BASE_URL}/${id}/events`,
      ),
    enabled: !!id,
  });
}

// --- Evidencia de entrega (POD) ---

export type ProofType = 'photo' | 'signature' | 'pin' | 'geo' | 'note';

export type ProofOfDelivery = {
  id: string;
  delivery_execution_id: string;
  type: ProofType | string;
  file_url?: string | null;
  signature_url?: string | null;
  captured_lat?: number | null;
  captured_lng?: number | null;
  captured_by?: string | null;
  pin_validated?: boolean | null;
  note?: string | null;
  captured_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export function useDeliveryExecutionProofs(id: string | undefined) {
  return useQuery({
    queryKey: [...DELIVERY_EXECUTIONS_QUERY_KEY, 'proofs', id],
    queryFn: () =>
      fetchJson<{ proofs_of_delivery: ProofOfDelivery[]; count: number }>(
        `${BASE_URL}/${id}/proofs`,
      ),
    enabled: !!id,
  });
}

// --- Asignación de driver/vehículo (flota propia) ---
//
// Corre el workflow assign-delivery en el backend. Tras el éxito invalidamos el
// detalle de ESTA ejecución y la lista del ops board (cambia status → assigned).

export type AssignDeliveryPayload = {
  driver_id: string;
  vehicle_id?: string | null;
  set_driver_on_route?: boolean;
};

export function useAssignDelivery(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignDeliveryPayload) =>
      fetchJson<{ assignment: unknown }>(`${BASE_URL}/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...DELIVERY_EXECUTIONS_QUERY_KEY, 'detail', id],
      });
      qc.invalidateQueries({ queryKey: DELIVERY_EXECUTIONS_QUERY_KEY });
    },
  });
}

export function useDeliveryExecutions(params?: DeliveryExecutionListParams) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  if (params?.provider_type) qs.set('provider_type', params.provider_type);
  if (params?.store_location_id)
    qs.set('store_location_id', params.store_location_id);
  if (params?.unrouted) qs.set('unrouted', 'true');
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...DELIVERY_EXECUTIONS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<DeliveryExecutionListResponse>(url),
  });
}

// --- Drivers (flota propia) ---

export const DRIVERS_QUERY_KEY = ['delivery-drivers'] as const;

export type DriverListParams = {
  status?: DriverStatus;
  active?: boolean;
  store_location_id?: string;
  limit?: number;
  offset?: number;
};

export type DriverListResponse = {
  drivers: Driver[];
  count: number;
  limit: number;
  offset: number;
};

export type CreateDriverPayload = {
  name: string;
  phone?: string | null;
  email?: string | null;
  status?: DriverStatus;
  store_location_id?: string | null;
  user_id?: string | null;
  max_active_deliveries?: number | null;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type UpdateDriverPayload = Partial<CreateDriverPayload>;

export function useDrivers(params?: DriverListParams) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.active != null) qs.set('active', String(params.active));
  if (params?.store_location_id)
    qs.set('store_location_id', params.store_location_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const url = qs.toString()
    ? `/admin/delivery/drivers?${qs.toString()}`
    : '/admin/delivery/drivers';
  return useQuery({
    queryKey: [...DRIVERS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<DriverListResponse>(url),
  });
}

export function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDriverPayload) =>
      fetchJson<{ driver: Driver }>('/admin/delivery/drivers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
    },
  });
}

export function useUpdateDriver(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDriverPayload) =>
      fetchJson<{ driver: Driver }>(`/admin/delivery/drivers/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
    },
  });
}

export function useDeleteDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ id: string; deleted: boolean }>(
        `/admin/delivery/drivers/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
      // Un driver borrado puede estar referenciado por vehículos.
      qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}

// --- Vehicles (flota propia) ---

export const VEHICLES_QUERY_KEY = ['delivery-vehicles'] as const;

export type VehicleListParams = {
  type?: VehicleType;
  driver_id?: string;
  active?: boolean;
  store_location_id?: string;
  limit?: number;
  offset?: number;
};

export type VehicleListResponse = {
  vehicles: Vehicle[];
  count: number;
  limit: number;
  offset: number;
};

export type CreateVehiclePayload = {
  plate: string;
  type: VehicleType;
  capacity_kg?: number | null;
  capacity_m3?: number | null;
  store_location_ids?: string[] | null;
  driver_id?: string | null;
  has_refrigeration?: boolean;
  max_orders?: number | null;
  temperature_modes?: TemperatureMode[] | null;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type UpdateVehiclePayload = Partial<CreateVehiclePayload>;

export function useVehicles(params?: VehicleListParams) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.driver_id) qs.set('driver_id', params.driver_id);
  if (params?.active != null) qs.set('active', String(params.active));
  if (params?.store_location_id)
    qs.set('store_location_id', params.store_location_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const url = qs.toString()
    ? `/admin/delivery/vehicles?${qs.toString()}`
    : '/admin/delivery/vehicles';
  return useQuery({
    queryKey: [...VEHICLES_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<VehicleListResponse>(url),
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVehiclePayload) =>
      fetchJson<{ vehicle: Vehicle }>('/admin/delivery/vehicles', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}

export function useUpdateVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateVehiclePayload) =>
      fetchJson<{ vehicle: Vehicle }>(`/admin/delivery/vehicles/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ id: string; deleted: boolean }>(
        `/admin/delivery/vehicles/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
    },
  });
}

// --- Zonas logísticas (M6) ---
//
// DeliveryZone (dzone). enabled_providers se persiste como JSON array de
// DeliveryProviderType. branch_coverage_id referencia la geometría que vive en
// store-location/BranchCoverage (acá solo se referencia el id, sin editor de
// polígonos). El backend ordena por priority DESC, created_at DESC.

export const ZONES_QUERY_KEY = ['delivery-zones'] as const;
export const ZONE_CONFLICTS_QUERY_KEY = ['delivery-zone-conflicts'] as const;

export type DeliveryZone = {
  id: string;
  name: string;
  store_location_id?: string | null;
  branch_coverage_id?: string | null;
  pricing_tier?: string | null;
  sla_hours?: number | null;
  /** Hora local 'HH:mm' de corte de pedidos. */
  cutoff_time?: string | null;
  /** JSON array de provider_type habilitados en la zona. */
  enabled_providers?: DeliveryProviderType[] | null;
  priority: number;
  active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type ZoneListParams = {
  store_location_id?: string;
  branch_coverage_id?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
};

export type ZoneListResponse = {
  zones: DeliveryZone[];
  count: number;
  limit: number;
  offset: number;
};

export type CreateZonePayload = {
  name: string;
  store_location_id?: string | null;
  branch_coverage_id?: string | null;
  pricing_tier?: string | null;
  sla_hours?: number | null;
  cutoff_time?: string | null;
  enabled_providers?: DeliveryProviderType[] | null;
  priority?: number;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type UpdateZonePayload = Partial<CreateZonePayload>;

export function useZones(params?: ZoneListParams) {
  const qs = new URLSearchParams();
  if (params?.store_location_id)
    qs.set('store_location_id', params.store_location_id);
  if (params?.branch_coverage_id)
    qs.set('branch_coverage_id', params.branch_coverage_id);
  if (params?.active != null) qs.set('active', String(params.active));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const url = qs.toString()
    ? `/admin/delivery/zones?${qs.toString()}`
    : '/admin/delivery/zones';
  return useQuery({
    queryKey: [...ZONES_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<ZoneListResponse>(url),
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateZonePayload) =>
      fetchJson<{ zone: DeliveryZone }>('/admin/delivery/zones', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZONES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ZONE_CONFLICTS_QUERY_KEY });
    },
  });
}

export function useUpdateZone(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateZonePayload) =>
      fetchJson<{ zone: DeliveryZone }>(`/admin/delivery/zones/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZONES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ZONE_CONFLICTS_QUERY_KEY });
      // Las reglas referencian zonas: refrescar para nombres/listados.
      qc.invalidateQueries({ queryKey: RULES_QUERY_KEY });
    },
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ id: string; deleted: boolean }>(
        `/admin/delivery/zones/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZONES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ZONE_CONFLICTS_QUERY_KEY });
      // Una zona borrada puede estar referenciada por reglas.
      qc.invalidateQueries({ queryKey: RULES_QUERY_KEY });
    },
  });
}

// --- Conflicto de zonas (solapamiento geométrico de coberturas) ---
//
// Dos zonas activas están en conflicto cuando los polígonos de sus coberturas se
// solapan. El endpoint devuelve además la geometría de cada zona (para el mapa).

/** Un punto del polígono almacenado: x=lng, y=lat (strings). */
export type ZonePolygonPoint = { x: string; y: string };

export type ZoneConflictGeometry = {
  zone_id: string;
  zone_name: string;
  store_location_id: string | null;
  store_name: string | null;
  branch_coverage_id: string;
  coverage_name: string | null;
  polygon: ZonePolygonPoint[];
};

export type ZoneConflictPair = {
  zone_a_id: string;
  zone_a_name: string;
  zone_b_id: string;
  zone_b_name: string;
  store_a_name: string | null;
  store_b_name: string | null;
};

export type ZoneConflictsResponse = {
  zones: ZoneConflictGeometry[];
  conflicts: ZoneConflictPair[];
  /** zoneId → ids de zonas con las que entra en conflicto. */
  by_zone: Record<string, string[]>;
};

export function useZoneConflicts() {
  return useQuery({
    queryKey: ZONE_CONFLICTS_QUERY_KEY,
    queryFn: () =>
      fetchJson<ZoneConflictsResponse>('/admin/delivery/zones/conflicts'),
  });
}

// --- Mapa de todas las coberturas (overview) ---

export const COVERAGES_OVERVIEW_QUERY_KEY = ['delivery-coverages-overview'] as const;

export type CoverageOverviewItem = {
  id: string;
  name: string;
  store_location_id: string | null;
  store_name: string | null;
  polygon: ZonePolygonPoint[];
};

export type CoveragesOverviewResponse = {
  coverages: CoverageOverviewItem[];
};

export function useCoveragesOverview() {
  return useQuery({
    queryKey: COVERAGES_OVERVIEW_QUERY_KEY,
    queryFn: () =>
      fetchJson<CoveragesOverviewResponse>(
        '/admin/delivery/coverages-overview',
      ),
  });
}

// --- Reglas de despacho (M6) ---
//
// DeliveryRule (drule). delivery_zone_id null = regla global. conditions es un
// array de predicados {field, op, value}; action es {assign_provider?,
// service_mode?, route_strategy?, surcharge?} (al menos un efecto, lo exige el
// backend). Ordena por priority DESC, created_at DESC.

export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'between'
  | 'contains';

export type RuleField =
  | 'weight_kg'
  | 'order_total'
  | 'item_count'
  | 'sku'
  | 'skus'
  | 'postal_code'
  | 'time_of_day'
  | 'zone_id'
  | 'pricing_tier'
  | 'temperature';

export type RouteStrategy = 'auto' | 'manual' | 'optimized';

// Estrategias de asignación automática de flota propia (F5/F7).
export type AssignStrategy = 'round_robin' | 'first_available' | 'least_load';

export type RulePredicateValue =
  | string
  | number
  | boolean
  | Array<string | number>;

export type RulePredicate = {
  field: RuleField;
  op: RuleOperator;
  value: RulePredicateValue;
};

export type RuleAction = {
  assign_provider?: DeliveryProviderType;
  service_mode?: DeliveryServiceMode;
  route_strategy?: RouteStrategy;
  surcharge?: number;
  // F5/F7 — asignación automática de flota propia.
  assign_strategy?: AssignStrategy;
  auto_assign?: boolean;
};

export type DeliveryRule = {
  id: string;
  name: string;
  /** null = regla global (aplica a cualquier zona). */
  delivery_zone_id?: string | null;
  priority: number;
  conditions: RulePredicate[];
  action: RuleAction;
  active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export const RULES_QUERY_KEY = ['delivery-rules'] as const;

export type RuleListParams = {
  delivery_zone_id?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
};

export type RuleListResponse = {
  rules: DeliveryRule[];
  count: number;
  limit: number;
  offset: number;
};

export type CreateRulePayload = {
  name: string;
  delivery_zone_id?: string | null;
  priority?: number;
  conditions: RulePredicate[];
  action: RuleAction;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type UpdateRulePayload = Partial<CreateRulePayload>;

export function useRules(params?: RuleListParams) {
  const qs = new URLSearchParams();
  if (params?.delivery_zone_id)
    qs.set('delivery_zone_id', params.delivery_zone_id);
  if (params?.active != null) qs.set('active', String(params.active));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const url = qs.toString()
    ? `/admin/delivery/rules?${qs.toString()}`
    : '/admin/delivery/rules';
  return useQuery({
    queryKey: [...RULES_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<RuleListResponse>(url),
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRulePayload) =>
      fetchJson<{ rule: DeliveryRule }>('/admin/delivery/rules', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_QUERY_KEY });
    },
  });
}

export function useUpdateRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRulePayload) =>
      fetchJson<{ rule: DeliveryRule }>(`/admin/delivery/rules/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_QUERY_KEY });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ id: string; deleted: boolean }>(
        `/admin/delivery/rules/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_QUERY_KEY });
    },
  });
}

// --- Turnos de repartidor (DriverShift, F7) ---
//
// Grilla semanal de disponibilidad. day_of_week 0..6 (0=domingo). start_time /
// end_time en 'HH:mm' local de la sucursal. Las queries se scopean por driverId.

export const DRIVER_SHIFTS_QUERY_KEY = ['delivery-driver-shifts'] as const;

export type DriverShift = {
  id: string;
  driver_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type CreateShiftPayload = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  active?: boolean;
};

export function useDriverShifts(driverId: string | undefined) {
  return useQuery({
    queryKey: [...DRIVER_SHIFTS_QUERY_KEY, driverId],
    queryFn: () =>
      fetchJson<{ shifts: DriverShift[]; count: number }>(
        `/admin/delivery/drivers/${driverId}/shifts`,
      ),
    enabled: !!driverId,
  });
}

export function useCreateDriverShift(driverId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateShiftPayload) =>
      fetchJson<{ shift: DriverShift }>(
        `/admin/delivery/drivers/${driverId}/shifts`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...DRIVER_SHIFTS_QUERY_KEY, driverId],
      });
    },
  });
}

export function useDeleteDriverShift(driverId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: string) =>
      fetchJson<{ id: string; deleted: boolean }>(
        `/admin/delivery/drivers/${driverId}/shifts/${shiftId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...DRIVER_SHIFTS_QUERY_KEY, driverId],
      });
    },
  });
}

// --- Recursos de zona (ZoneResource, F7) ---
//
// Asocia drivers / vehicles a una DeliveryZone (relación N:M). Las queries se
// scopean por zoneId.

export const ZONE_RESOURCES_QUERY_KEY = ['delivery-zone-resources'] as const;

export type ZoneResourceType = 'driver' | 'vehicle';

export type ZoneResource = {
  id: string;
  delivery_zone_id: string;
  resource_type: ZoneResourceType;
  resource_id: string;
  active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type CreateZoneResourcePayload = {
  resource_type: ZoneResourceType;
  resource_id: string;
  active?: boolean;
};

export function useZoneResources(zoneId: string | undefined) {
  return useQuery({
    queryKey: [...ZONE_RESOURCES_QUERY_KEY, zoneId],
    queryFn: () =>
      fetchJson<{ resources: ZoneResource[]; count: number }>(
        `/admin/delivery/zones/${zoneId}/resources`,
      ),
    enabled: !!zoneId,
  });
}

export function useCreateZoneResource(zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateZoneResourcePayload) =>
      fetchJson<{ zone_resource: ZoneResource }>(
        `/admin/delivery/zones/${zoneId}/resources`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...ZONE_RESOURCES_QUERY_KEY, zoneId],
      });
    },
  });
}

export function useDeleteZoneResource(zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: string) =>
      fetchJson<{ id: string; deleted: boolean }>(
        `/admin/delivery/zones/${zoneId}/resources/${resourceId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...ZONE_RESOURCES_QUERY_KEY, zoneId],
      });
    },
  });
}

// --- Asignación automática de flota propia (F5/F7) ---
//
// POST auto-assign corre el workflow auto-assign-delivery: resuelve elegibles,
// elige driver(+vehicle) por estrategia y delega en assign-delivery. NO lanza
// error si no hay elegibles: devuelve { assigned: false, reason, rejected }.

export type RejectedResource = {
  resource_type: string;
  id: string;
  reason: string;
};

export type AutoAssignPayload = {
  strategy?: AssignStrategy;
  vehicle_id?: string;
};

export type AutoAssignResult = {
  execution_id: string;
  assigned: boolean;
  driver_id?: string | null;
  vehicle_id?: string | null;
  strategy: AssignStrategy;
  reason?: string;
  rejected: RejectedResource[];
};

export function useAutoAssign(executionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: AutoAssignPayload) =>
      fetchJson<{ assignment: AutoAssignResult }>(
        `${BASE_URL}/${executionId}/auto-assign`,
        { method: 'POST', body: JSON.stringify(body ?? {}) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...DELIVERY_EXECUTIONS_QUERY_KEY, 'detail', executionId],
      });
      qc.invalidateQueries({ queryKey: DELIVERY_EXECUTIONS_QUERY_KEY });
    },
  });
}

// GET eligible-resources — previsualiza candidatos elegibles y rechazados antes
// de auto-asignar. Solo lectura.
export type EligibleResources = {
  eligible_drivers: { id: string; load: number }[];
  eligible_vehicles: { id: string }[];
  rejected: RejectedResource[];
};

export function useEligibleResources(executionId: string | undefined) {
  return useQuery({
    queryKey: [
      ...DELIVERY_EXECUTIONS_QUERY_KEY,
      'eligible-resources',
      executionId,
    ],
    queryFn: () =>
      fetchJson<{ eligible_resources: EligibleResources }>(
        `${BASE_URL}/${executionId}/eligible-resources`,
      ),
    enabled: !!executionId,
  });
}

// --- Auto-armado de rutas (F6/F7) ---
//
// POST auto-build corre auto-build-routes: bin-packing de las ejecuciones
// own_fleet sin rutear entre los vehículos. Devuelve las rutas creadas y las
// ejecuciones que no pudieron asignarse.

export type AutoBuildRoutesPayload = {
  store_location_id: string;
  delivery_zone_id?: string | null;
  planned_date?: string | null;
  max_orders_per_vehicle?: number | null;
  fill_priority?: 'fill_first' | 'balance';
  optimize?: boolean;
};

export type AutoBuildRoutesResult = {
  routes: {
    route_id: string;
    code: string;
    vehicle_id: string | null;
    stop_count: number;
  }[];
  unassigned_execution_ids: string[];
};

export function useAutoBuildRoutes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AutoBuildRoutesPayload) =>
      fetchJson<AutoBuildRoutesResult>('/admin/delivery/routes/auto-build', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      // Refresca las listas de rutas y de ejecuciones (cambian route_id).
      qc.invalidateQueries({ queryKey: ['delivery-routes'] });
      qc.invalidateQueries({ queryKey: DELIVERY_EXECUTIONS_QUERY_KEY });
    },
  });
}
