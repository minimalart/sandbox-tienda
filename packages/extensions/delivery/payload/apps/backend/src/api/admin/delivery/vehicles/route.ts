import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { VEHICLE_SITE_SCOPE } from '../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../modules/delivery';
import type DeliveryModuleService from '../../../../modules/delivery/service';
import type {
  AdminCreateVehicleType,
  AdminListVehiclesType,
} from '../validators';

// GET /admin/delivery/vehicles — lista de vehículos de flota propia.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const q = req.validatedQuery as unknown as AdminListVehiclesType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;

  const filters: Record<string, unknown> = {};
  if (q.type) filters.type = q.type;
  if (q.driver_id) filters.driver_id = q.driver_id;
  if (typeof q.active === 'boolean') filters.active = q.active;

  // Al WHERE, no en memoria: filtrar después haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), VEHICLE_SITE_SCOPE));

  // store_location_ids es un array (jsonb): el filtro generado no soporta
  // "contiene". Si se pide filtrar por sucursal, traemos el set completo y
  // filtramos por membresía + paginamos en memoria (la flota es chica).
  if (q.store_location_id) {
    const all = (await service.listVehicles(filters, {
      order: { created_at: 'DESC' },
    })) as Array<Record<string, unknown>>;
    const matched = all.filter((v) =>
      Array.isArray(v.store_location_ids) &&
      (v.store_location_ids as string[]).includes(q.store_location_id as string),
    );
    const vehicles = matched.slice(offset, offset + limit);
    res.status(200).json({ vehicles, count: matched.length, offset, limit });
    return;
  }

  const [vehicles, count] = await service.listAndCountVehicles(filters, {
    take: limit,
    skip: offset,
    order: { created_at: 'DESC' },
  });

  res.status(200).json({ vehicles, count, offset, limit });
}

// POST /admin/delivery/vehicles — crea un vehículo.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = req.validatedBody as AdminCreateVehicleType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const created = await service.createVehicles({
    plate: body.plate,
    type: body.type,
    capacity_kg: body.capacity_kg ?? null,
    capacity_m3: body.capacity_m3 ?? null,
    // store_location_ids es model.json(): el array se persiste como JSON.
    store_location_ids: (body.store_location_ids ?? null) as unknown as
      | Record<string, unknown>
      | null,
    driver_id: body.driver_id ?? null,
    has_refrigeration: body.has_refrigeration ?? false,
    max_orders: body.max_orders ?? null,
    // temperature_modes es model.json(): el array se persiste como JSON.
    temperature_modes: (body.temperature_modes ?? null) as unknown as
      | Record<string, unknown>
      | null,
    active: body.active ?? true,
    metadata: (body.metadata ?? null) as Record<string, unknown> | null,
  });

  const vehicle = Array.isArray(created) ? created[0] : created;
  res.status(201).json({ vehicle });
}
