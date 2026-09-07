import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { DELIVERY_ROUTE_SITE_SCOPE } from '../../../../../modules/delivery/site-scope';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../modules/delivery/service';
import type { AdminUpdateRouteType } from '../../validators';

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// GET /admin/delivery/routes/:id — detalle de la ruta con paradas ordenadas.
//
// Por cada parada resolvemos en vivo, vía query.graph sobre el link
// delivery_execution_order, los datos de solo-lectura de la ejecución y su orden:
//   - execution status / provider_type
//   - order display_id + email
//   - dirección (shipping_address) + lat/lng (del snapshot del stop)
// NO se duplican datos: la dirección y la orden viven en el módulo Order y se
// leen a través del link. El stop solo es dueño de sequence/status/lat/lng.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ROUTE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const route = (await service
    .retrieveRoute(id)
    .catch(() => null)) as UnknownRecord | null;
  if (!route) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Route '${id}' no existe.`);
  }

  // Paradas ordenadas por sequence.
  const stops = (await service.listRouteStops(
    { route_id: id },
    { order: { sequence: 'ASC' } },
  )) as UnknownRecord[];

  // Resolución en vivo de los datos linkeados de cada ejecución (una sola query).
  const executionIds = stops.map((s) => String(s.delivery_execution_id));
  const executionById = new Map<string, UnknownRecord>();
  if (executionIds.length) {
    const { data: executions } = await query.graph({
      entity: 'delivery_execution',
      fields: [
        'id',
        'status',
        'provider_type',
        'service_mode',
        'order.id',
        'order.display_id',
        'order.email',
        'order.shipping_address.address_1',
        'order.shipping_address.city',
        'order.shipping_address.postal_code',
      ],
      filters: { id: executionIds },
    });
    for (const e of (executions ?? []) as UnknownRecord[]) {
      executionById.set(String(e.id), e);
    }
  }

  const enrichedStops = stops.map((s) => {
    const execution = executionById.get(String(s.delivery_execution_id));
    const order = execution && isRecord(execution.order) ? execution.order : null;
    const address =
      order && isRecord(order.shipping_address) ? order.shipping_address : null;
    return {
      id: s.id,
      route_id: s.route_id,
      delivery_execution_id: s.delivery_execution_id,
      sequence: s.sequence,
      status: s.status,
      eta: s.eta,
      arrived_at: s.arrived_at,
      completed_at: s.completed_at,
      lat: s.lat,
      lng: s.lng,
      execution: execution
        ? {
            id: execution.id,
            status: execution.status,
            provider_type: execution.provider_type,
            service_mode: execution.service_mode,
          }
        : null,
      order: order
        ? {
            id: order.id,
            display_id: order.display_id ?? null,
            email: order.email ?? null,
          }
        : null,
      address: address
        ? {
            address_1: address.address_1 ?? null,
            city: address.city ?? null,
            postal_code: address.postal_code ?? null,
          }
        : null,
    };
  });

  res.status(200).json({ route: { ...route, stops: enrichedStops } });
}

// POST /admin/delivery/routes/:id — update parcial de metadatos de la ruta.
// NO toca las paradas (eso va por /routes/:id/stops).
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ROUTE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const body = req.validatedBody as AdminUpdateRouteType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const existing = await service.retrieveRoute(id).catch(() => null);
  if (!existing) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Route '${id}' no existe.`);
  }

  const update: Record<string, unknown> = { id };
  if (body.driver_id !== undefined) update.driver_id = body.driver_id;
  if (body.vehicle_id !== undefined) update.vehicle_id = body.vehicle_id;
  if (body.store_location_id !== undefined)
    update.store_location_id = body.store_location_id;
  if (body.planned_date !== undefined)
    update.planned_date = body.planned_date ? new Date(body.planned_date) : null;
  if (body.status !== undefined) update.status = body.status;
  if (body.metadata !== undefined) update.metadata = body.metadata;

  const updated = await service.updateRoutes(update);
  const route = Array.isArray(updated) ? updated[0] : updated;

  res.status(200).json({ route });
}

// DELETE /admin/delivery/routes/:id — soft delete de la ruta.
//
// Limpia el route_id de las ejecuciones que pertenecían a la ruta y borra sus
// paradas, para no dejar ejecuciones colgadas apuntando a una ruta borrada.
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ROUTE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const stops = (await service.listRouteStops({
    route_id: id,
  })) as UnknownRecord[];

  if (stops.length) {
    await service.deleteRouteStops(stops.map((s) => String(s.id)));
    for (const s of stops) {
      await service.updateDeliveryExecutions({
        id: String(s.delivery_execution_id),
        route_id: null,
      });
    }
  }

  await service.deleteRoutes([id]);

  res.status(200).json({ id, object: 'delivery_route', deleted: true });
}
