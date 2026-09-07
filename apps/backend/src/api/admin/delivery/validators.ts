import { z } from 'zod';

// Estados operativos de la DeliveryExecution (ver modules/delivery/types.ts).
export const DELIVERY_STATUS_VALUES = [
  'pending',
  'ready',
  'assigned',
  'picked_up',
  'in_transit',
  'at_pickup_point',
  'delivered',
  'failed_attempt',
  'canceled',
] as const;

// Quién ejecuta físicamente la entrega.
export const DELIVERY_PROVIDER_VALUES = [
  'andreani',
  'own_fleet',
  'store_pickup',
] as const;

export const AdminListDeliveryExecutionsSchema = z.object({
  status: z.enum(DELIVERY_STATUS_VALUES).optional(),
  provider_type: z.enum(DELIVERY_PROVIDER_VALUES).optional(),
  // M10: scoping por tienda. Filtra por la columna directa store_location_id.
  store_location_id: z.string().optional(),
  // M7: true → solo ejecuciones SIN ruta (route_id null). Para el armado de rutas.
  unrouted: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type AdminListDeliveryExecutionsType = z.infer<
  typeof AdminListDeliveryExecutionsSchema
>;

// --- Control Tower / Analytics (M9) ---
//
// Rango de fechas obligatorio (from/to en ISO o YYYY-MM-DD) + filtros opcionales.
// El service normaliza el rango (to inclusivo a fin de día) y traduce
// store_location_id a las zonas de esa sucursal.
export const AdminDeliveryMetricsSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  store_location_id: z.string().optional(),
  provider_type: z.enum(DELIVERY_PROVIDER_VALUES).optional(),
});
export type AdminDeliveryMetricsType = z.infer<typeof AdminDeliveryMetricsSchema>;

// --- Drivers (flota propia, M3) ---

export const DRIVER_STATUS_VALUES = ['available', 'on_route', 'offline'] as const;
export const VEHICLE_TYPE_VALUES = [
  'motorcycle',
  'van',
  'truck',
  'car',
] as const;

export const AdminListDriversSchema = z.object({
  status: z.enum(DRIVER_STATUS_VALUES).optional(),
  store_location_id: z.string().optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type AdminListDriversType = z.infer<typeof AdminListDriversSchema>;

export const AdminCreateDriverSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  email: z.string().email().nullish(),
  status: z.enum(DRIVER_STATUS_VALUES).optional(),
  store_location_id: z.string().nullish(),
  user_id: z.string().nullish(),
  // F7 — tope de entregas activas simultáneas (null = sin tope).
  max_active_deliveries: z.number().int().positive().nullish(),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type AdminCreateDriverType = z.infer<typeof AdminCreateDriverSchema>;

export const AdminUpdateDriverSchema = AdminCreateDriverSchema.partial();
export type AdminUpdateDriverType = z.infer<typeof AdminUpdateDriverSchema>;

// --- Vehicles (flota propia, M3) ---

export const AdminListVehiclesSchema = z.object({
  type: z.enum(VEHICLE_TYPE_VALUES).optional(),
  // Filtra vehículos que operan en esta sucursal (membresía en store_location_ids).
  store_location_id: z.string().optional(),
  driver_id: z.string().optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type AdminListVehiclesType = z.infer<typeof AdminListVehiclesSchema>;

// Modos de temperatura soportados por un vehículo (compatibilidad de frío, F7).
export const TEMPERATURE_MODE_VALUES = [
  'ambient',
  'refrigerated',
  'frozen',
] as const;

export const AdminCreateVehicleSchema = z.object({
  plate: z.string().min(1),
  type: z.enum(VEHICLE_TYPE_VALUES),
  capacity_kg: z.number().int().positive().nullish(),
  capacity_m3: z.number().int().positive().nullish(),
  // Sucursales en las que opera el vehículo (multi-sucursal).
  store_location_ids: z.array(z.string().min(1)).nullish(),
  driver_id: z.string().nullish(),
  // F7 — capacidad de frío y compatibilidad de temperatura.
  has_refrigeration: z.boolean().optional(),
  max_orders: z.number().int().positive().nullish(),
  temperature_modes: z.array(z.enum(TEMPERATURE_MODE_VALUES)).nullish(),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type AdminCreateVehicleType = z.infer<typeof AdminCreateVehicleSchema>;

export const AdminUpdateVehicleSchema = AdminCreateVehicleSchema.partial();
export type AdminUpdateVehicleType = z.infer<typeof AdminUpdateVehicleSchema>;

// --- Asignación de ejecución (flota propia, M3) ---

export const AdminAssignDeliverySchema = z.object({
  driver_id: z.string().min(1),
  vehicle_id: z.string().nullish(),
  set_driver_on_route: z.boolean().optional(),
  // Mete la ejecución en la ruta del driver para el día (o la crea / la mueve si
  // se reasigna). Default true: la asignación manual también arma/mueve la ruta.
  attach_to_route: z.boolean().optional().default(true),
});
export type AdminAssignDeliveryType = z.infer<typeof AdminAssignDeliverySchema>;

// --- Asignación AUTOMÁTICA de ejecución (flota propia, F5) ---
//
// Ambos campos opcionales: si no se pasa `strategy`, el workflow la resuelve por
// precedencia (regla ganadora > metadata de zona > default global). `vehicle_id`
// fuerza un vehículo concreto saltando el best-fit.
export const ASSIGN_STRATEGY_VALUES_SCHEMA = [
  'round_robin',
  'first_available',
  'least_load',
] as const;

export const AdminAutoAssignSchema = z.object({
  strategy: z.enum(ASSIGN_STRATEGY_VALUES_SCHEMA).optional(),
  vehicle_id: z.string().min(1).optional(),
});
export type AdminAutoAssignType = z.infer<typeof AdminAutoAssignSchema>;

// --- Zonas logísticas (M6) ---

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const AdminListZonesSchema = z.object({
  store_location_id: z.string().optional(),
  branch_coverage_id: z.string().optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type AdminListZonesType = z.infer<typeof AdminListZonesSchema>;

export const AdminCreateZoneSchema = z.object({
  name: z.string().min(1),
  store_location_id: z.string().nullish(),
  branch_coverage_id: z.string().nullish(),
  pricing_tier: z.string().nullish(),
  sla_hours: z.number().int().positive().nullish(),
  cutoff_time: z.string().regex(HHMM, "Formato 'HH:mm'").nullish(),
  enabled_providers: z.array(z.enum(DELIVERY_PROVIDER_VALUES)).nullish(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type AdminCreateZoneType = z.infer<typeof AdminCreateZoneSchema>;

export const AdminUpdateZoneSchema = AdminCreateZoneSchema.partial();
export type AdminUpdateZoneType = z.infer<typeof AdminUpdateZoneSchema>;

// --- Reglas de despacho (M6) ---

export const RULE_OPERATOR_VALUES = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'between',
  'contains',
] as const;

export const RULE_FIELD_VALUES = [
  'weight_kg',
  'order_total',
  'item_count',
  'sku',
  'skus',
  'postal_code',
  'time_of_day',
  'zone_id',
  'pricing_tier',
  'temperature',
] as const;

export const ROUTE_STRATEGY_VALUES = ['auto', 'manual', 'optimized'] as const;

// Estrategias de asignación automática de flota propia (F5).
export const ASSIGN_STRATEGY_VALUES = [
  'round_robin',
  'first_available',
  'least_load',
] as const;

const PredicateValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

export const RulePredicateSchema = z.object({
  field: z.enum(RULE_FIELD_VALUES),
  op: z.enum(RULE_OPERATOR_VALUES),
  value: PredicateValueSchema,
});

export const RuleActionSchema = z
  .object({
    assign_provider: z.enum(DELIVERY_PROVIDER_VALUES).optional(),
    service_mode: z
      .enum(['home_delivery', 'hop', 'branch_pickup', 'store_pickup'])
      .optional(),
    route_strategy: z.enum(ROUTE_STRATEGY_VALUES).optional(),
    surcharge: z.number().int().min(0).optional(),
    // F5 — asignación automática de flota propia.
    assign_strategy: z.enum(ASSIGN_STRATEGY_VALUES).optional(),
    auto_assign: z.boolean().optional(),
  })
  .refine((a) => Object.keys(a).length > 0, {
    message: 'La acción debe definir al menos un efecto.',
  });

export const AdminListRulesSchema = z.object({
  delivery_zone_id: z.string().optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type AdminListRulesType = z.infer<typeof AdminListRulesSchema>;

export const AdminCreateRuleSchema = z.object({
  name: z.string().min(1),
  delivery_zone_id: z.string().nullish(),
  priority: z.number().int().optional(),
  conditions: z.array(RulePredicateSchema),
  action: RuleActionSchema,
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type AdminCreateRuleType = z.infer<typeof AdminCreateRuleSchema>;

export const AdminUpdateRuleSchema = AdminCreateRuleSchema.partial();
export type AdminUpdateRuleType = z.infer<typeof AdminUpdateRuleSchema>;

// --- Rutas (M7 — Route Planner manual) ---

export const ROUTE_STATUS_VALUES = [
  'planned',
  'dispatched',
  'in_progress',
  'completed',
  'canceled',
] as const;

export const AdminListRoutesSchema = z.object({
  status: z.enum(ROUTE_STATUS_VALUES).optional(),
  driver_id: z.string().optional(),
  store_location_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type AdminListRoutesType = z.infer<typeof AdminListRoutesSchema>;

export const AdminCreateRouteSchema = z.object({
  store_location_id: z.string().nullish(),
  driver_id: z.string().nullish(),
  vehicle_id: z.string().nullish(),
  // Acepta ISO date/datetime; se normaliza a Date en el workflow.
  planned_date: z.string().datetime().nullish(),
  // Ejecuciones a rutear, en el orden deseado (sequence 1..n). Solo flota propia.
  execution_ids: z.array(z.string().min(1)).optional(),
});
export type AdminCreateRouteType = z.infer<typeof AdminCreateRouteSchema>;

// Update de metadatos de la ruta (NO toca paradas — eso va por /stops).
export const AdminUpdateRouteSchema = z
  .object({
    driver_id: z.string().nullish(),
    vehicle_id: z.string().nullish(),
    store_location_id: z.string().nullish(),
    planned_date: z.string().datetime().nullish(),
    status: z.enum(ROUTE_STATUS_VALUES).optional(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: 'El update debe definir al menos un campo.',
  });
export type AdminUpdateRouteType = z.infer<typeof AdminUpdateRouteSchema>;

// --- Auto-armado de rutas (F6) ---
//
// Toma las ejecuciones own_fleet sin rutear de la sucursal (y zona si viene),
// las reparte por bin-packing entre los vehículos y crea una Route por bin.
export const AdminAutoBuildRoutesSchema = z.object({
  store_location_id: z.string().min(1),
  delivery_zone_id: z.string().nullish(),
  planned_date: z.string().datetime().nullish(),
  max_orders_per_vehicle: z.number().int().positive().nullish(),
  fill_priority: z.enum(['fill_first', 'balance']).optional(),
  optimize: z.boolean().optional(),
});
export type AdminAutoBuildRoutesType = z.infer<
  typeof AdminAutoBuildRoutesSchema
>;

// --- Turnos de repartidor (DriverShift, F7) ---
//
// Grilla semanal de disponibilidad. day_of_week 0..6 (0=domingo, convención JS).
// start_time/end_time en 'HH:mm' local de la sucursal.
export const AdminCreateShiftSchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: z.string().regex(HHMM, "Formato 'HH:mm'"),
  end_time: z.string().regex(HHMM, "Formato 'HH:mm'"),
  active: z.boolean().optional(),
});
export type AdminCreateShiftType = z.infer<typeof AdminCreateShiftSchema>;

// --- Recursos de zona (ZoneResource, F7) ---
//
// Asocia un driver o vehicle a una DeliveryZone (relación N:M zona↔recursos).
export const ZONE_RESOURCE_TYPE_VALUES = ['driver', 'vehicle'] as const;

export const AdminCreateZoneResourceSchema = z.object({
  resource_type: z.enum(ZONE_RESOURCE_TYPE_VALUES),
  resource_id: z.string().min(1),
  active: z.boolean().optional(),
});
export type AdminCreateZoneResourceType = z.infer<
  typeof AdminCreateZoneResourceSchema
>;

// Reemplazo completo del set de paradas (estado final deseado, orden = sequence).
export const AdminUpdateRouteStopsSchema = z.object({
  stops: z
    .array(
      z.object({
        delivery_execution_id: z.string().min(1),
        sequence: z.number().int().positive(),
      }),
    )
    .min(0),
});
export type AdminUpdateRouteStopsType = z.infer<
  typeof AdminUpdateRouteStopsSchema
>;
