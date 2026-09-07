import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { DRIVER_SITE_SCOPE } from '../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../modules/delivery';
import type DeliveryModuleService from '../../../../modules/delivery/service';
import type {
  AdminCreateDriverType,
  AdminListDriversType,
} from '../validators';

// GET /admin/delivery/drivers — lista de repartidores de flota propia.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const q = req.validatedQuery as unknown as AdminListDriversType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;

  const filters: Record<string, unknown> = {};
  if (q.status) filters.status = q.status;
  if (q.store_location_id) filters.store_location_id = q.store_location_id;
  if (typeof q.active === 'boolean') filters.active = q.active;

  // Al WHERE, no en memoria: filtrar después haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), DRIVER_SITE_SCOPE));

  const [drivers, count] = await service.listAndCountDrivers(filters, {
    take: limit,
    skip: offset,
    order: { created_at: 'DESC' },
  });

  res.status(200).json({ drivers, count, offset, limit });
}

// POST /admin/delivery/drivers — crea un repartidor.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = req.validatedBody as AdminCreateDriverType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const created = await service.createDrivers({
    name: body.name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    status: body.status ?? 'offline',
    store_location_id: body.store_location_id ?? null,
    user_id: body.user_id ?? null,
    max_active_deliveries: body.max_active_deliveries ?? null,
    active: body.active ?? true,
    metadata: (body.metadata ?? null) as Record<string, unknown> | null,
  });

  const driver = Array.isArray(created) ? created[0] : created;
  res.status(201).json({ driver });
}
