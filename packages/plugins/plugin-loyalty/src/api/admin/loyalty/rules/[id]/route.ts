import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { LOYALTY_EARN_RULE_SITE_SCOPE } from '../../../../../modules/loyalty/site-scope';
import { LOYALTY_MODULE } from '../../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../../modules/loyalty/service';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), LOYALTY_EARN_RULE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const rule = await service.retrieveEarnRule(req.params.id as string);
  res.json({ rule });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), LOYALTY_EARN_RULE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const updated = await service.updateEarnRules({
    id: req.params.id,
    ...(req.validatedBody as Record<string, unknown>),
  });
  res.json({ rule: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), LOYALTY_EARN_RULE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  await service.deleteEarnRules([req.params.id]);
  res.json({ id: req.params.id, object: 'loyalty_earn_rule', deleted: true });
}
