import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { LOYALTY_REWARD_GRANT_SITE_SCOPE } from '../../../../modules/loyalty/site-scope';
import { LOYALTY_MODULE } from '../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../modules/loyalty/service';

// Redemptions (reward grants) for the backoffice "Canjes" list.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const filters: Record<string, unknown> = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.customer_id) filters.customer_id = req.query.customer_id;

  // El filtro va al WHERE: filtrar en memoria haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), LOYALTY_REWARD_GRANT_SITE_SCOPE));
  const [grants, count] = await service.listAndCountRewardGrants(filters, {
    relations: ['reward'],
    order: { created_at: 'DESC' },
    take: 100,
  });
  res.json({ grants, count });
}
