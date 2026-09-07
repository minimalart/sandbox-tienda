import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { LOYALTY_MODULE } from '../../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../../modules/loyalty/service';
import { POINTS_MODULE } from '../../../../../modules/points';
import type PointsModuleService from '../../../../../modules/points/service';
import { gatherCustomerMetrics } from '../../../../../modules/loyalty/lib/metrics';
import { tierProgress } from '../../../../../modules/loyalty/lib/tiers';

// A customer's loyalty summary for the customer-detail admin widget: balance,
// tier + progress, recent ledger movements and reward grants.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.params.id as string;
  const points = req.scope.resolve<PointsModuleService>(POINTS_MODULE);
  const loyalty = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);

  const balance = await points.getAvailableBalance(customerId);
  const accounts = (await points.listPointsAccounts({ customer_id: customerId })) as Array<{ id: string }>;
  const account = accounts[0];
  const transactions = account
    ? await points.listPointsTransactions(
        { account_id: account.id },
        { order: { created_at: 'DESC' }, take: 20 },
      )
    : [];
  const grants = await loyalty.listRewardGrants(
    { customer_id: customerId },
    { relations: ['reward'], order: { created_at: 'DESC' }, take: 20 },
  );

  let tier: unknown = null;
  let progress: { next: unknown; toNext: number; metrics: unknown } | null = null;
  const program = await loyalty.getActiveProgram();
  if (program) {
    const tiers = (await loyalty.listTiers(
      { program_id: program.id },
      { order: { threshold: 'ASC' } },
    )) as Array<Record<string, any>>;
    const metrics = await gatherCustomerMetrics(req.scope, customerId);
    const p = tierProgress(tiers as any, metrics);
    tier = p.current;
    progress = { next: p.next, toNext: p.toNext, metrics };
  }

  res.json({ balance, tier, progress, transactions, grants });
}
