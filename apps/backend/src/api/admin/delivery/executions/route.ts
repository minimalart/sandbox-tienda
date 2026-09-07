import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { DELIVERY_EXECUTION_SITE_SCOPE } from '../../../../modules/delivery/site-scope';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { AdminListDeliveryExecutionsType } from '../validators';

// GET /admin/delivery/executions — ops board (read-only).
//
// Lista DeliveryExecutions con paginación y filtros opcionales (status,
// provider_type). Para CADA execution resolvemos en vivo los datos linkeados de
// solo-lectura a través de los links ya definidos (src/links/delivery-execution-*):
//   - order (display_id, email)            → link delivery_execution_order
//   - fulfillment (shipped/delivered/...)  → link delivery_execution_fulfillment
//
// NO se duplican datos: se traversan los links con el Query module en una sola
// llamada. El Fulfillment de Medusa sigue siendo la verdad comercial.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const q = req.validatedQuery as unknown as AdminListDeliveryExecutionsType;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;

  const filters: Record<string, unknown> = {};
  if (q.status) filters.status = q.status;
  if (q.provider_type) filters.provider_type = q.provider_type;

  // Al WHERE, no en memoria: filtrar después haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), DELIVERY_EXECUTION_SITE_SCOPE));
  // M10: scoping por tienda directo (columna store_location_id).
  if (q.store_location_id) filters.store_location_id = q.store_location_id;
  // M7: solo ejecuciones sin ruta (para el armado del Route Planner).
  if (q.unrouted) filters.route_id = null;

  const { data: executions, metadata } = await query.graph({
    entity: 'delivery_execution',
    fields: [
      'id',
      'provider_type',
      'service_mode',
      'status',
      'external_shipment_id',
      'tracking_number',
      'label_url',
      'assigned_at',
      'dispatched_at',
      'delivered_at',
      'failed_at',
      'attempt_count',
      'scheduled_window',
      'delivery_zone_id',
      'store_location_id',
      'driver_id',
      'vehicle_id',
      'route_id',
      'last_event_at',
      'created_at',
      'updated_at',
      // Order linkeada (read-only) — verdad comercial / contacto.
      'order.id',
      'order.display_id',
      'order.email',
      // Fulfillment linkeado (read-only) — verdad comercial del envío.
      'fulfillment.id',
      'fulfillment.shipped_at',
      'fulfillment.delivered_at',
      'fulfillment.canceled_at',
    ],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: { created_at: 'DESC' },
    },
  });

  res.status(200).json({
    delivery_executions: executions,
    count: metadata?.count ?? executions.length,
    offset,
    limit,
  });
}
