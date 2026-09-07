import {
  type MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';
import {
  AdminAssignDeliverySchema,
  AdminAutoAssignSchema,
  AdminCreateDriverSchema,
  AdminCreateRuleSchema,
  AdminCreateVehicleSchema,
  AdminCreateZoneSchema,
  AdminListDeliveryExecutionsSchema,
  AdminListDriversSchema,
  AdminListRulesSchema,
  AdminListVehiclesSchema,
  AdminListZonesSchema,
  AdminUpdateDriverSchema,
  AdminUpdateRuleSchema,
  AdminUpdateVehicleSchema,
  AdminUpdateZoneSchema,
  AdminCreateRouteSchema,
  AdminListRoutesSchema,
  AdminUpdateRouteSchema,
  AdminUpdateRouteStopsSchema,
  AdminAutoBuildRoutesSchema,
  AdminDeliveryMetricsSchema,
  AdminCreateShiftSchema,
  AdminCreateZoneResourceSchema,
} from './validators';

// /admin/* ya recibe auth de admin del framework. Acá solo agregamos validación.
export const adminDeliveryMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/delivery/executions',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminListDeliveryExecutionsSchema as any, {
        isList: true,
      }),
    ],
  },
  // --- Control Tower / Analytics (M9) ---
  {
    matcher: '/admin/delivery/analytics',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminDeliveryMetricsSchema as any, {}),
    ],
  },
  // --- Asignación de ejecución (flota propia) ---
  {
    matcher: '/admin/delivery/executions/:id/assign',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminAssignDeliverySchema)],
  },
  // --- Asignación AUTOMÁTICA (flota propia, F5) ---
  {
    matcher: '/admin/delivery/executions/:id/auto-assign',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminAutoAssignSchema)],
  },
  // --- Drivers ---
  {
    matcher: '/admin/delivery/drivers',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminListDriversSchema as any, { isList: true }),
    ],
  },
  {
    matcher: '/admin/delivery/drivers',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateDriverSchema)],
  },
  {
    matcher: '/admin/delivery/drivers/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminUpdateDriverSchema)],
  },
  // --- Turnos de repartidor (DriverShift, F7) ---
  {
    matcher: '/admin/delivery/drivers/:id/shifts',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateShiftSchema)],
  },
  // --- Vehicles ---
  {
    matcher: '/admin/delivery/vehicles',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminListVehiclesSchema as any, { isList: true }),
    ],
  },
  {
    matcher: '/admin/delivery/vehicles',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateVehicleSchema)],
  },
  {
    matcher: '/admin/delivery/vehicles/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminUpdateVehicleSchema)],
  },
  // --- Zonas logísticas (M6) ---
  {
    matcher: '/admin/delivery/zones',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminListZonesSchema as any, { isList: true }),
    ],
  },
  {
    matcher: '/admin/delivery/zones',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateZoneSchema)],
  },
  {
    matcher: '/admin/delivery/zones/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminUpdateZoneSchema)],
  },
  // --- Recursos de zona (ZoneResource, F7) ---
  {
    matcher: '/admin/delivery/zones/:id/resources',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateZoneResourceSchema)],
  },
  // --- Reglas de despacho (M6) ---
  {
    matcher: '/admin/delivery/rules',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminListRulesSchema as any, { isList: true }),
    ],
  },
  {
    matcher: '/admin/delivery/rules',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateRuleSchema)],
  },
  {
    matcher: '/admin/delivery/rules/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminUpdateRuleSchema)],
  },
  // --- Rutas (M7 — Route Planner manual) ---
  {
    matcher: '/admin/delivery/routes',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminListRoutesSchema as any, { isList: true }),
    ],
  },
  {
    matcher: '/admin/delivery/routes',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminCreateRouteSchema)],
  },
  // --- Auto-armado de rutas (F6) ---
  {
    matcher: '/admin/delivery/routes/auto-build',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminAutoBuildRoutesSchema)],
  },
  {
    matcher: '/admin/delivery/routes/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminUpdateRouteSchema)],
  },
  {
    matcher: '/admin/delivery/routes/:id/stops',
    method: ['POST', 'PUT'],
    middlewares: [validateAndTransformBody(AdminUpdateRouteStopsSchema)],
  },
];
