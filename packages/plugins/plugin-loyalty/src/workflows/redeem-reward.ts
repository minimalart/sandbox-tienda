import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
// NOTE: `@medusajs/core-flows` must NOT be imported at module top-level. Its
// module side-effects call `createWorkflow(...)` for every core workflow it
// exports, which registers each id (e.g. `create-payment-sessions`) into the
// global WorkflowManager. When the host boots, it ALSO loads core-flows for
// its own use — the second load throws
//   "Workflow with id 'create-payment-sessions' and step definition already exists".
// The lazy import inside the step body defers evaluation until the redeem step
// actually runs, so at boot only the host's core-flows registers.
import { LOYALTY_MODULE } from '../modules/loyalty';
import type LoyaltyModuleService from '../modules/loyalty/service';
import { POINTS_MODULE } from '../modules/points';
import type PointsModuleService from '../modules/points/service';
import { rewardRedeemability, benefitTypeFor, buildPromotionInput } from '../modules/loyalty/lib/rewards';
import { computeCustomerTier } from '../modules/loyalty/lib/tiers';
import { gatherCustomerMetrics } from '../modules/loyalty/lib/metrics';

export type RedeemRewardInput = {
  customer_id: string;
  reward_id: string;
  // Unique per redemption request (the store route generates it). Drives the
  // coupon code, the debit idempotency key and double-submit dedup.
  redemption_ref: string;
  sales_channel_id?: string | null;
};

// One transactional step implementing the redeem saga by hand so the PRD
// invariant holds: validate → debit points → create the Medusa benefit; if the
// benefit fails, the points are refunded (idempotently) and the error rethrown,
// so points are never lost. Only on full success is the RewardGrant created and
// stock decremented.
const redeemStep = createStep(
  'loyalty-redeem-reward',
  async (input: RedeemRewardInput, { container }) => {
    const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
    const points = container.resolve<PointsModuleService>(POINTS_MODULE);

    const reward = (await loyalty.retrieveReward(input.reward_id)) as Record<string, any>;
    const code = `LOY-${input.redemption_ref.toUpperCase()}`;

    // Idempotency / double-submit: a grant already issued for this coupon code.
    const existing = (await loyalty.listRewardGrants({ benefit_ref: code })) as Array<Record<string, any>>;
    if (existing.length) {
      return new StepResponse({ grant: existing[0], already: true });
    }

    const now = Date.now();
    const check = rewardRedeemability(reward as any, now);
    if (!check.ok) throw new Error(check.reason ?? 'Recompensa no disponible');

    // Tier segmentation: if the reward is restricted to certain tiers, the
    // customer's current tier must be among them.
    const allowedTiers: string[] = Array.isArray(reward.segments?.tier_ids) ? reward.segments.tier_ids : [];
    if (allowedTiers.length) {
      const program = await loyalty.getActiveProgram();
      const tiers = program
        ? ((await loyalty.listTiers({ program_id: program.id })) as Array<Record<string, any>>)
        : [];
      const metrics = await gatherCustomerMetrics(container, input.customer_id);
      const tier = computeCustomerTier(tiers as any, metrics);
      if (!tier || !allowedTiers.includes(tier.id)) {
        throw new Error('Esta recompensa no está disponible para tu nivel');
      }
    }

    const cost = Number(reward.cost_points) || 0;
    if (cost <= 0) throw new Error('La recompensa no tiene un costo válido');

    const balance = await points.getAvailableBalance(input.customer_id);
    if (balance < cost) throw new Error('Saldo de puntos insuficiente');

    const currencyCode = (reward.config?.currency_code as string) || 'ars';

    // 1) Debit points (idempotent by redemption ref).
    await points.redeemPoints(input.customer_id, cost, {
      reference: 'reward',
      reference_id: reward.id,
      idempotency_key: `redeem:${input.redemption_ref}`,
    });

    // 2) Produce the benefit. On any failure, refund and rethrow.
    let benefit_type: 'promotion' | 'store_credit' | null = null;
    let benefit_ref: string | null = null;
    try {
      const kind = benefitTypeFor(reward.type);
      if (kind === 'promotion') {
        const promoData = buildPromotionInput(reward as any, code, currencyCode, input.sales_channel_id);
        if (promoData) {
          const { createPromotionsWorkflow } = await import('@medusajs/core-flows');
          await createPromotionsWorkflow(container).run({ input: { promotionsData: [promoData] } as any });
          benefit_type = 'promotion';
          benefit_ref = code;
        }
      } else if (kind === 'store_credit') {
        const value = Number(reward.config?.value) || 0;
        // Loaded lazily so loyalty-engine doesn't hard-couple to the gift-card runtime.
        const { createGiftCardsWorkflow } = await import('@medusajs/loyalty-plugin/workflows');
        const giftCardInput = [
          {
            value,
            currency_code: currencyCode,
            customer_id: input.customer_id,
            reference: 'loyalty_reward',
            reference_id: reward.id,
            metadata: { loyalty_redemption: input.redemption_ref },
          },
        ];
        const { result } = await createGiftCardsWorkflow(container).run({
          input: giftCardInput as any,
        });
        benefit_type = 'store_credit';
        benefit_ref = (result as Array<{ id?: string }>)?.[0]?.id ?? null;
      }
    } catch (err) {
      await points.adjustPoints(input.customer_id, cost, {
        reference: 'redeem_refund',
        reference_id: reward.id,
        idempotency_key: `refund:${input.redemption_ref}`,
      });
      throw err;
    }

    // 3) Record the grant + decrement stock.
    const grant = await loyalty.createRewardGrants({
      reward_id: reward.id,
      customer_id: input.customer_id,
      status: 'available',
      benefit_type,
      benefit_ref,
      points_spent: cost,
      expires_at: reward.valid_to ?? null,
    });
    if (reward.stock != null) {
      await loyalty.updateRewards({ id: reward.id, stock: Math.max(0, Number(reward.stock) - 1) });
    }

    return new StepResponse({ grant, already: false });
  },
);

export const redeemRewardWorkflow = createWorkflow(
  'redeem-reward',
  (input: RedeemRewardInput) => {
    return new WorkflowResponse(redeemStep(input));
  },
);
