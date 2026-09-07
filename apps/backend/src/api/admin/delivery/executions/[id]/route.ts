import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { DELIVERY_EXECUTION_SITE_SCOPE } from '../../../../../modules/delivery/site-scope';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../modules/delivery/service';

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// GET /admin/delivery/executions/:id — detalle de UNA ejecución para el panel.
//
// La DeliveryExecution es el sidecar operativo: dueña de status / provider /
// timestamps / asignación (driver_id, vehicle_id, delivery_zone_id). Los datos
// COMERCIALES (order + shipping_address, fulfillment) NO viven acá: se traversan
// en vivo vía los links (delivery_execution_order / _fulfillment) con query.graph.
//
// driver / vehicle / zona son FK LÓGICAS del MISMO módulo delivery (no links
// cross-module ni relaciones nombradas en el graph), así que se resuelven por id
// con el service del módulo en una sola lectura cada uno (solo si hay id).
//
// 404 si la ejecución no existe.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_EXECUTION_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // Datos propios del sidecar + datos linkeados (read-only) en una sola query.
  const { data: executions } = await query.graph({
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
      // Costo operativo interno estimado (Y4): recargo de reglas como métrica de
      // costeo, NO un cargo al cliente.
      'estimated_cost',
      'driver_id',
      'vehicle_id',
      'route_id',
      'last_event_at',
      'created_at',
      'updated_at',
      // Order linkeada (read-only) — verdad comercial / contacto / dirección.
      'order.id',
      'order.display_id',
      'order.email',
      'order.shipping_address.first_name',
      'order.shipping_address.last_name',
      'order.shipping_address.address_1',
      'order.shipping_address.city',
      'order.shipping_address.postal_code',
      'order.shipping_address.phone',
      // Fulfillment linkeado (read-only) — verdad comercial del envío.
      'fulfillment.id',
      'fulfillment.shipped_at',
      'fulfillment.delivered_at',
      'fulfillment.canceled_at',
    ],
    filters: { id },
  });

  const execution = (executions ?? [])[0] as UnknownRecord | undefined;
  if (!execution) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `DeliveryExecution '${id}' no existe.`,
    );
  }

  // --- Asignación / zona: FK lógicas del mismo módulo, resueltas por id. ---
  let driver: UnknownRecord | null = null;
  if (execution.driver_id) {
    driver = (await service
      .retrieveDriver(String(execution.driver_id))
      .catch(() => null)) as UnknownRecord | null;
  }

  let vehicle: UnknownRecord | null = null;
  if (execution.vehicle_id) {
    vehicle = (await service
      .retrieveVehicle(String(execution.vehicle_id))
      .catch(() => null)) as UnknownRecord | null;
  }

  let zone: UnknownRecord | null = null;
  if (execution.delivery_zone_id) {
    zone = (await service
      .retrieveDeliveryZone(String(execution.delivery_zone_id))
      .catch(() => null)) as UnknownRecord | null;
  }

  const order = isRecord(execution.order) ? execution.order : null;
  const address =
    order && isRecord(order.shipping_address) ? order.shipping_address : null;
  const fulfillment = isRecord(execution.fulfillment)
    ? execution.fulfillment
    : null;

  res.status(200).json({
    delivery_execution: {
      id: execution.id,
      provider_type: execution.provider_type,
      service_mode: execution.service_mode,
      status: execution.status,
      external_shipment_id: execution.external_shipment_id ?? null,
      tracking_number: execution.tracking_number ?? null,
      label_url: execution.label_url ?? null,
      assigned_at: execution.assigned_at ?? null,
      dispatched_at: execution.dispatched_at ?? null,
      delivered_at: execution.delivered_at ?? null,
      failed_at: execution.failed_at ?? null,
      attempt_count: execution.attempt_count ?? 0,
      scheduled_window: execution.scheduled_window ?? null,
      delivery_zone_id: execution.delivery_zone_id ?? null,
      store_location_id: execution.store_location_id ?? null,
      // Costo operativo interno estimado (Y4). Métrica de costeo, NO un cargo al
      // cliente (el envío se cobró en checkout). En la unidad menor de la moneda.
      estimated_cost: execution.estimated_cost ?? null,
      driver_id: execution.driver_id ?? null,
      vehicle_id: execution.vehicle_id ?? null,
      route_id: execution.route_id ?? null,
      last_event_at: execution.last_event_at ?? null,
      created_at: execution.created_at ?? null,
      updated_at: execution.updated_at ?? null,
      order: order
        ? {
            id: order.id,
            display_id: order.display_id ?? null,
            email: order.email ?? null,
            shipping_address: address
              ? {
                  first_name: address.first_name ?? null,
                  last_name: address.last_name ?? null,
                  address_1: address.address_1 ?? null,
                  city: address.city ?? null,
                  postal_code: address.postal_code ?? null,
                  phone: address.phone ?? null,
                }
              : null,
          }
        : null,
      fulfillment: fulfillment
        ? {
            id: fulfillment.id,
            shipped_at: fulfillment.shipped_at ?? null,
            delivered_at: fulfillment.delivered_at ?? null,
            canceled_at: fulfillment.canceled_at ?? null,
          }
        : null,
      driver: driver
        ? {
            id: driver.id,
            name: driver.name,
            phone: driver.phone ?? null,
            status: driver.status ?? null,
          }
        : null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            plate: vehicle.plate,
            type: vehicle.type ?? null,
          }
        : null,
      zone: zone
        ? {
            id: zone.id,
            name: zone.name,
          }
        : null,
    },
  });
}
