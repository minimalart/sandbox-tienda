import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { DELIVERY_ROUTE_SITE_SCOPE } from '../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../modules/delivery';
import type DeliveryModuleService from '../../../../modules/delivery/service';
import createRouteWorkflow from '../../../../workflows/create-route';
import type {
  AdminCreateRouteType,
  AdminListRoutesType,
} from '../validators';

type UnknownRecord = Record<string, unknown>;

// GET /admin/delivery/routes — lista de rutas con cantidad de paradas.
//
// Las rutas agrupan ejecuciones de FLOTA PROPIA. Para cada ruta devolvemos su
// stop_count contando los RouteStop asociados (sin traer cada parada — eso es del
// detalle). driver_id/vehicle_id se devuelven crudos; la UI los resuelve aparte.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const q = req.validatedQuery as unknown as AdminListRoutesType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;

  const filters: Record<string, unknown> = {};
  if (q.status) filters.status = q.status;
  if (q.driver_id) filters.driver_id = q.driver_id;
  if (q.store_location_id) filters.store_location_id = q.store_location_id;

  // Al WHERE, no en memoria: filtrar después haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), DELIVERY_ROUTE_SITE_SCOPE));

  const [routes, count] = await service.listAndCountRoutes(filters, {
    take: limit,
    skip: offset,
    order: { planned_date: 'DESC', created_at: 'DESC' },
  });

  // Conteo de paradas por ruta en una sola consulta sobre los ids de la página.
  const routeIds = (routes as UnknownRecord[]).map((r) => String(r.id));
  const stopCounts = new Map<string, number>();
  if (routeIds.length) {
    const stops = (await service.listRouteStops(
      { route_id: routeIds },
      { take: 10000 },
    )) as UnknownRecord[];
    for (const s of stops) {
      const rid = String(s.route_id);
      stopCounts.set(rid, (stopCounts.get(rid) ?? 0) + 1);
    }
  }

  const data = (routes as UnknownRecord[]).map((r) => ({
    ...r,
    stop_count: stopCounts.get(String(r.id)) ?? 0,
  }));

  res.status(200).json({ routes: data, count, offset, limit });
}

// POST /admin/delivery/routes — crea una ruta (workflow create-route).
//
// Si vienen execution_ids, crea las paradas en orden y setea route_id en cada
// ejecución. Solo flota propia (el workflow valida y rechaza el resto).
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = req.validatedBody as AdminCreateRouteType;

  const { result } = await createRouteWorkflow(req.scope).run({
    input: {
      store_location_id: body.store_location_id ?? null,
      driver_id: body.driver_id ?? null,
      vehicle_id: body.vehicle_id ?? null,
      planned_date: body.planned_date ?? null,
      execution_ids: body.execution_ids ?? [],
    },
  });

  res.status(201).json({ route: result });
}
