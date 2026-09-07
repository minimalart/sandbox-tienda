import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { DELIVERY_RULE_SITE_SCOPE } from '../../../../../modules/delivery/site-scope';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../modules/delivery/service';
import type { AdminUpdateRuleType } from '../../validators';

// GET /admin/delivery/rules/:id
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_RULE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const rule = await service.retrieveDeliveryRule(id).catch(() => null);
  if (!rule) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `DeliveryRule '${id}' no existe.`,
    );
  }

  res.status(200).json({ rule });
}

// POST /admin/delivery/rules/:id — update parcial.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_RULE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const body = req.validatedBody as AdminUpdateRuleType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const update: Record<string, unknown> = { id };
  if (body.name !== undefined) update.name = body.name;
  if (body.delivery_zone_id !== undefined)
    update.delivery_zone_id = body.delivery_zone_id;
  if (body.priority !== undefined) update.priority = body.priority;
  if (body.conditions !== undefined) update.conditions = body.conditions;
  if (body.action !== undefined) update.action = body.action;
  if (body.active !== undefined) update.active = body.active;
  if (body.metadata !== undefined) update.metadata = body.metadata;

  const updated = await service.updateDeliveryRules(update);
  const rule = Array.isArray(updated) ? updated[0] : updated;

  res.status(200).json({ rule });
}

// DELETE /admin/delivery/rules/:id — soft delete.
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_RULE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  await service.deleteDeliveryRules([id]);

  res.status(200).json({ id, object: 'delivery_rule', deleted: true });
}
