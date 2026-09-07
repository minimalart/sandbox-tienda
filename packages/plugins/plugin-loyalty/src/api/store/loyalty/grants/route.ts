import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { LOYALTY_MODULE } from '../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../modules/loyalty/service';

// The authenticated customer's reward grants (their obtained benefits).
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    res.status(401).json({ message: 'No autenticado' });
    return;
  }

  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const grants = (await service.listRewardGrants(
    { customer_id: customerId },
    { relations: ['reward'], order: { created_at: 'DESC' } },
  )) as Array<Record<string, any>>;

  res.json({ grants });
}
