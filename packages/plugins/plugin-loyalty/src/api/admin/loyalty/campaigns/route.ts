import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { LOYALTY_CAMPAIGN_SITE_SCOPE } from '../../../../modules/loyalty/site-scope';
import { LOYALTY_MODULE } from '../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../modules/loyalty/service';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const filters: Record<string, unknown> = {};
  if (req.query.program_id) filters.program_id = req.query.program_id;

  // El filtro va al WHERE: filtrar en memoria haría que `count` mienta y las
  // páginas salgan de tamaño variable.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), LOYALTY_CAMPAIGN_SITE_SCOPE));
  const [campaigns, count] = await service.listAndCountCampaigns(filters, {
    order: { priority: 'DESC', created_at: 'DESC' },
  });
  res.json({ campaigns, count });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const created = await service.createCampaigns(req.validatedBody as Record<string, unknown>);
  res.status(201).json({ campaign: created });
}
