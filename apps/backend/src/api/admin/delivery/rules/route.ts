import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { DELIVERY_RULE_SITE_SCOPE } from '../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../modules/delivery';
import type DeliveryModuleService from '../../../../modules/delivery/service';
import type { AdminCreateRuleType, AdminListRulesType } from '../validators';

// GET /admin/delivery/rules — lista de reglas de despacho.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const q = req.validatedQuery as unknown as AdminListRulesType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;

  const filters: Record<string, unknown> = {};
  if (q.delivery_zone_id) filters.delivery_zone_id = q.delivery_zone_id;
  if (typeof q.active === 'boolean') filters.active = q.active;

  // Al WHERE, no en memoria: filtrar después haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), DELIVERY_RULE_SITE_SCOPE));

  const [rules, count] = await service.listAndCountDeliveryRules(filters, {
    take: limit,
    skip: offset,
    order: { priority: 'DESC', created_at: 'DESC' },
  });

  res.status(200).json({ rules, count, offset, limit });
}

// POST /admin/delivery/rules — crea una regla.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = req.validatedBody as AdminCreateRuleType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const created = await service.createDeliveryRules({
    name: body.name,
    delivery_zone_id: body.delivery_zone_id ?? null,
    priority: body.priority ?? 0,
    conditions: body.conditions as unknown as Record<string, unknown>,
    action: body.action as unknown as Record<string, unknown>,
    active: body.active ?? true,
    metadata: (body.metadata ?? null) as Record<string, unknown> | null,
  });

  const rule = Array.isArray(created) ? created[0] : created;
  res.status(201).json({ rule });
}
