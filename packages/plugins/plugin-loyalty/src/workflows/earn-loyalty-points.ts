import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { LOYALTY_MODULE } from '../modules/loyalty';
import type LoyaltyModuleService from '../modules/loyalty/service';
import { POINTS_MODULE } from '../modules/points';
import type PointsModuleService from '../modules/points/service';
import { computeEarnedPoints } from '../modules/loyalty/lib/earn';
import {
  isRuleApplicable,
  pickCampaignMultiplier,
  capByLimits,
  computeExpiryAt,
} from '../modules/loyalty/lib/rules';
import { computeCustomerTier, tierMultiplier } from '../modules/loyalty/lib/tiers';
import { gatherCustomerMetrics } from '../modules/loyalty/lib/metrics';

export type EarnLoyaltyPointsInput = {
  customer_id: string;
  event: 'purchase' | 'signup' | 'first_purchase' | 'order_delivered' | 'birthday' | 'referral' | 'comment';
  amount?: number;
  reference?: string | null;
  reference_id?: string | null;
  sales_channel_id?: string | null;
  category_ids?: string[];
  collection_ids?: string[];
  brand_ids?: string[];
};

type Awarded = { customer_id: string; points: number; idempotency_key: string };

// Evaluates the active program's earn rules for the event, applies the best
// active campaign multiplier and per-customer/day limits, and writes idempotent
// ledger entries. Compensation reverses every entry it wrote, so a downstream
// failure never leaves points credited.
const awardStep = createStep(
  'loyalty-award-points',
  async (input: EarnLoyaltyPointsInput, { container }) => {
    const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
    const points = container.resolve<PointsModuleService>(POINTS_MODULE);
    const awarded: Awarded[] = [];

    const program = await loyalty.getActiveProgram();
    if (!program) return new StepResponse({ awarded }, { awarded });

    const now = Date.now();
    const starts = program.starts_at ? new Date(program.starts_at as string).getTime() : null;
    const ends = program.ends_at ? new Date(program.ends_at as string).getTime() : null;
    if ((starts && now < starts) || (ends && now > ends)) {
      return new StepResponse({ awarded }, { awarded });
    }

    const rules = (await loyalty.listEarnRules({
      program_id: program.id,
      event: input.event,
      status: 'active',
    })) as Array<Record<string, any>>;
    if (!rules.length) return new StepResponse({ awarded }, { awarded });

    const campaigns = (await loyalty.listCampaigns({
      program_id: program.id,
      status: 'active',
    })) as Array<Record<string, any>>;

    // Tier multiplier (VIP levels). Only gather metrics when tiers exist.
    let tierMult = 1;
    const tiers = (await loyalty.listTiers({ program_id: program.id })) as Array<Record<string, any>>;
    if (tiers.length) {
      const metrics = await gatherCustomerMetrics(container, input.customer_id);
      tierMult = tierMultiplier(computeCustomerTier(tiers as any, metrics));
    }

    const amount = Number(input.amount) || 0;
    const expiresAt = computeExpiryAt((program as Record<string, any>).expiration_policy ?? null, now);
    const ctx = {
      amount,
      customer_id: input.customer_id,
      now,
      sales_channel_id: input.sales_channel_id ?? null,
      category_ids: input.category_ids,
      collection_ids: input.collection_ids,
      brand_ids: input.brand_ids,
    };

    const account = await points.getOrCreateAccount(input.customer_id);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    for (const rule of rules) {
      if (!isRuleApplicable(rule as any, ctx)) continue;

      const campaignMult = pickCampaignMultiplier(campaigns as any, rule.id, now);
      let pts = computeEarnedPoints(rule as any, amount, campaignMult * tierMult);
      if (pts <= 0) continue;

      const limits = rule.limits as { per_customer?: number; per_day?: number } | null;
      if (limits && (limits.per_customer != null || limits.per_day != null)) {
        const priorEarns = (await points.listPointsTransactions({
          account_id: account.id,
          earn_rule_id: rule.id,
          type: 'earn',
        })) as Array<Record<string, any>>;
        const lifetimeEarned = priorEarns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const todayEarned = priorEarns
          .filter((t) => new Date(t.created_at).getTime() >= startOfDay.getTime())
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
        pts = capByLimits(limits, pts, lifetimeEarned, todayEarned);
      }
      if (pts <= 0) continue;

      const idempotency_key = `earn:${input.event}:${input.reference_id ?? 'na'}:${rule.id}`;
      const res = await points.earnPoints(input.customer_id, pts, {
        reference: input.reference ?? input.event,
        reference_id: input.reference_id ?? null,
        idempotency_key,
        program_id: program.id,
        earn_rule_id: rule.id,
        expires_at: expiresAt,
      });
      if (res) awarded.push({ customer_id: input.customer_id, points: pts, idempotency_key });
    }

    return new StepResponse({ awarded }, { awarded });
  },
  async (data, { container }) => {
    if (!data?.awarded?.length) return;
    const points = container.resolve<PointsModuleService>(POINTS_MODULE);
    for (const a of data.awarded) {
      await points.reversePoints(a.customer_id, a.points, {
        reference: 'earn_compensation',
        idempotency_key: `reverse:${a.idempotency_key}`,
      });
    }
  },
);

export const earnLoyaltyPointsWorkflow = createWorkflow(
  'earn-loyalty-points',
  (input: EarnLoyaltyPointsInput) => {
    return new WorkflowResponse(awardStep(input));
  },
);
