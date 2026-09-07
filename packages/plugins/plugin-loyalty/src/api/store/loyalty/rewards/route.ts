import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { LOYALTY_MODULE } from '../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../modules/loyalty/service';
import { rewardRedeemability } from '../../../../modules/loyalty/lib/rewards';

// Redeemable rewards for the active program, cheapest first.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
  const program = await service.getActiveProgram();
  if (!program) {
    res.json({ rewards: [], points_name: 'puntos' });
    return;
  }

  const rewards = (await service.listRewards(
    { program_id: program.id, status: 'active' },
    { order: { cost_points: 'ASC' } },
  )) as Array<Record<string, any>>;

  const now = Date.now();
  const redeemable = rewards.filter((r) => rewardRedeemability(r as any, now).ok);

  res.json({ rewards: redeemable, points_name: program.points_name ?? 'puntos' });
}
