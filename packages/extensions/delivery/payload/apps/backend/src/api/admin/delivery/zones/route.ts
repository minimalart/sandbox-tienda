import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { DELIVERY_ZONE_SITE_SCOPE } from '../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../modules/delivery';
import type DeliveryModuleService from '../../../../modules/delivery/service';
import type { AdminCreateZoneType, AdminListZonesType } from '../validators';

// GET /admin/delivery/zones — lista de zonas logísticas.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const q = req.validatedQuery as unknown as AdminListZonesType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;

  const filters: Record<string, unknown> = {};
  if (q.store_location_id) filters.store_location_id = q.store_location_id;
  if (q.branch_coverage_id) filters.branch_coverage_id = q.branch_coverage_id;
  if (typeof q.active === 'boolean') filters.active = q.active;

  // Al WHERE, no en memoria: filtrar después haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), DELIVERY_ZONE_SITE_SCOPE));

  const [zones, count] = await service.listAndCountDeliveryZones(filters, {
    take: limit,
    skip: offset,
    order: { priority: 'DESC', created_at: 'DESC' },
  });

  res.status(200).json({ zones, count, offset, limit });
}

// POST /admin/delivery/zones — crea una zona.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = req.validatedBody as AdminCreateZoneType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const created = await service.createDeliveryZones({
    name: body.name,
    store_location_id: body.store_location_id ?? null,
    branch_coverage_id: body.branch_coverage_id ?? null,
    pricing_tier: body.pricing_tier ?? null,
    sla_hours: body.sla_hours ?? null,
    cutoff_time: body.cutoff_time ?? null,
    enabled_providers: (body.enabled_providers ?? null) as unknown as Record<
      string,
      unknown
    > | null,
    priority: body.priority ?? 0,
    active: body.active ?? true,
    metadata: (body.metadata ?? null) as Record<string, unknown> | null,
  });

  const zone = Array.isArray(created) ? created[0] : created;
  res.status(201).json({ zone });
}
