import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { resolveDriverFromAuth } from '../../resolve-driver';

type UnknownRecord = Record<string, unknown>;

// GET /store/delivery/driver/me/stops — lista las ejecuciones asignadas al
// repartidor autenticado (PWA flota propia). Resuelve el driver desde el user
// autenticado (link driver-user vía columna user_id) y trae las executions con
// la order/dirección mínima vía query.graph a través de los links.
//
// Excluye estados terminales por defecto (delivered/canceled) — son las paradas
// "pendientes" del día.
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const driver = await resolveDriverFromAuth(req);
  const driverId = String(driver.id);

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: executions } = await query.graph({
    entity: 'delivery_execution',
    fields: [
      'id',
      'provider_type',
      'service_mode',
      'status',
      'driver_id',
      'vehicle_id',
      'scheduled_window',
      'attempt_count',
      'last_event_at',
      'created_at',
      // Order linkeada (read-only): contacto + dirección de envío mínima.
      'order.id',
      'order.display_id',
      'order.email',
      'order.shipping_address.first_name',
      'order.shipping_address.last_name',
      'order.shipping_address.address_1',
      'order.shipping_address.address_2',
      'order.shipping_address.city',
      'order.shipping_address.postal_code',
      'order.shipping_address.province',
      'order.shipping_address.phone',
    ],
    filters: {
      driver_id: driverId,
      // Solo paradas activas: excluye terminales.
      status: ['pending', 'ready', 'assigned', 'picked_up', 'in_transit', 'at_pickup_point', 'failed_attempt'],
    },
    pagination: { order: { created_at: 'ASC' } },
  });

  res.status(200).json({
    driver: {
      id: driverId,
      name: driver.name ?? null,
      status: driver.status ?? null,
    },
    stops: (executions ?? []) as UnknownRecord[],
    count: (executions ?? []).length,
  });
}
