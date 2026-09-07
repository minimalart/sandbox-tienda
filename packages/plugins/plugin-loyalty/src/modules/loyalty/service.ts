import { MedusaService } from '@medusajs/framework/utils';
import {
  LoyaltyProgram,
  EarnRule,
  Reward,
  RewardGrant,
  Tier,
  Campaign,
} from './models';

class LoyaltyModuleService extends MedusaService({
  LoyaltyProgram,
  EarnRule,
  Reward,
  RewardGrant,
  Tier,
  Campaign,
}) {
  // The single active program (MVP: one program). Most-recently-created active one.
  async getActiveProgram(): Promise<{ id: string; [key: string]: unknown } | null> {
    const programs = await this.listLoyaltyPrograms(
      { status: 'active' },
      { order: { created_at: 'DESC' }, take: 1 },
    );
    return programs[0] ?? null;
  }
}

export default LoyaltyModuleService;
