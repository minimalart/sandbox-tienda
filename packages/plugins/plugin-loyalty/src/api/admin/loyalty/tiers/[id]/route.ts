import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { LOYALTY_MODULE } from '../../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../../modules/loyalty/service';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const updated = await service.updateTiers({
    id: req.params.id,
    ...(req.validatedBody as Record<string, unknown>),
  });
  res.json({ tier: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  await service.deleteTiers([req.params.id]);
  res.json({ id: req.params.id, object: 'loyalty_tier', deleted: true });
}
