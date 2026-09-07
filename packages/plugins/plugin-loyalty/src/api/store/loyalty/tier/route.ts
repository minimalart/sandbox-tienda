import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { LOYALTY_MODULE } from '../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../modules/loyalty/service';
import { gatherCustomerMetrics } from '../../../../modules/loyalty/lib/metrics';
import { tierProgress } from '../../../../modules/loyalty/lib/tiers';

// The authenticated customer's current tier + progress to the next one.
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    res.status(401).json({ message: 'No autenticado' });
    return;
  }

  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const program = await service.getActiveProgram();
  if (!program) {
    res.json({ tier: null, next: null, toNext: 0, metrics: null });
    return;
  }

  const tiers = (await service.listTiers(
    { program_id: program.id },
    { order: { threshold: 'ASC' } },
  )) as Array<Record<string, any>>;
  const metrics = await gatherCustomerMetrics(req.scope, customerId);
  const { current, next, toNext } = tierProgress(tiers as any, metrics);

  res.json({ tier: current, next, toNext, metrics });
}
