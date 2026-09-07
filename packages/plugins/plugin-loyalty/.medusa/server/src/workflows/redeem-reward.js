"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemRewardWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
// NOTE: `@medusajs/core-flows` must NOT be imported at module top-level. Its
// module side-effects call `createWorkflow(...)` for every core workflow it
// exports, which registers each id (e.g. `create-payment-sessions`) into the
// global WorkflowManager. When the host boots, it ALSO loads core-flows for
// its own use — the second load throws
//   "Workflow with id 'create-payment-sessions' and step definition already exists".
// The lazy import inside the step body defers evaluation until the redeem step
// actually runs, so at boot only the host's core-flows registers.
const loyalty_1 = require("../modules/loyalty");
const points_1 = require("../modules/points");
const rewards_1 = require("../modules/loyalty/lib/rewards");
const tiers_1 = require("../modules/loyalty/lib/tiers");
const metrics_1 = require("../modules/loyalty/lib/metrics");
// One transactional step implementing the redeem saga by hand so the PRD
// invariant holds: validate → debit points → create the Medusa benefit; if the
// benefit fails, the points are refunded (idempotently) and the error rethrown,
// so points are never lost. Only on full success is the RewardGrant created and
// stock decremented.
const redeemStep = (0, workflows_sdk_1.createStep)('loyalty-redeem-reward', async (input, { container }) => {
    const loyalty = container.resolve(loyalty_1.LOYALTY_MODULE);
    const points = container.resolve(points_1.POINTS_MODULE);
    const reward = (await loyalty.retrieveReward(input.reward_id));
    const code = `LOY-${input.redemption_ref.toUpperCase()}`;
    // Idempotency / double-submit: a grant already issued for this coupon code.
    const existing = (await loyalty.listRewardGrants({ benefit_ref: code }));
    if (existing.length) {
        return new workflows_sdk_1.StepResponse({ grant: existing[0], already: true });
    }
    const now = Date.now();
    const check = (0, rewards_1.rewardRedeemability)(reward, now);
    if (!check.ok)
        throw new Error(check.reason ?? 'Recompensa no disponible');
    // Tier segmentation: if the reward is restricted to certain tiers, the
    // customer's current tier must be among them.
    const allowedTiers = Array.isArray(reward.segments?.tier_ids) ? reward.segments.tier_ids : [];
    if (allowedTiers.length) {
        const program = await loyalty.getActiveProgram();
        const tiers = program
            ? (await loyalty.listTiers({ program_id: program.id }))
            : [];
        const metrics = await (0, metrics_1.gatherCustomerMetrics)(container, input.customer_id);
        const tier = (0, tiers_1.computeCustomerTier)(tiers, metrics);
        if (!tier || !allowedTiers.includes(tier.id)) {
            throw new Error('Esta recompensa no está disponible para tu nivel');
        }
    }
    const cost = Number(reward.cost_points) || 0;
    if (cost <= 0)
        throw new Error('La recompensa no tiene un costo válido');
    const balance = await points.getAvailableBalance(input.customer_id);
    if (balance < cost)
        throw new Error('Saldo de puntos insuficiente');
    const currencyCode = reward.config?.currency_code || 'ars';
    // 1) Debit points (idempotent by redemption ref).
    await points.redeemPoints(input.customer_id, cost, {
        reference: 'reward',
        reference_id: reward.id,
        idempotency_key: `redeem:${input.redemption_ref}`,
    });
    // 2) Produce the benefit. On any failure, refund and rethrow.
    let benefit_type = null;
    let benefit_ref = null;
    try {
        const kind = (0, rewards_1.benefitTypeFor)(reward.type);
        if (kind === 'promotion') {
            const promoData = (0, rewards_1.buildPromotionInput)(reward, code, currencyCode, input.sales_channel_id);
            if (promoData) {
                const { createPromotionsWorkflow } = await import('@medusajs/core-flows');
                await createPromotionsWorkflow(container).run({ input: { promotionsData: [promoData] } });
                benefit_type = 'promotion';
                benefit_ref = code;
            }
        }
        else if (kind === 'store_credit') {
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
                input: giftCardInput,
            });
            benefit_type = 'store_credit';
            benefit_ref = result?.[0]?.id ?? null;
        }
    }
    catch (err) {
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
    return new workflows_sdk_1.StepResponse({ grant, already: false });
});
exports.redeemRewardWorkflow = (0, workflows_sdk_1.createWorkflow)('redeem-reward', (input) => {
    return new workflows_sdk_1.WorkflowResponse(redeemStep(input));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVkZWVtLXJld2FyZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvcmVkZWVtLXJld2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsNkVBQTZFO0FBQzdFLDRFQUE0RTtBQUM1RSw2RUFBNkU7QUFDN0UsNEVBQTRFO0FBQzVFLHVDQUF1QztBQUN2QyxxRkFBcUY7QUFDckYsK0VBQStFO0FBQy9FLGtFQUFrRTtBQUNsRSxnREFBb0Q7QUFFcEQsOENBQWtEO0FBRWxELDREQUEwRztBQUMxRyx3REFBbUU7QUFDbkUsNERBQXVFO0FBV3ZFLHlFQUF5RTtBQUN6RSwrRUFBK0U7QUFDL0UsZ0ZBQWdGO0FBQ2hGLGdGQUFnRjtBQUNoRixxQkFBcUI7QUFDckIsTUFBTSxVQUFVLEdBQUcsSUFBQSwwQkFBVSxFQUMzQix1QkFBdUIsRUFDdkIsS0FBSyxFQUFFLEtBQXdCLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQ2hELE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFzQixzQkFBYSxDQUFDLENBQUM7SUFFckUsTUFBTSxNQUFNLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUF3QixDQUFDO0lBQ3RGLE1BQU0sSUFBSSxHQUFHLE9BQU8sS0FBSyxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO0lBRXpELDRFQUE0RTtJQUM1RSxNQUFNLFFBQVEsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxDQUFDLENBQStCLENBQUM7SUFDdkcsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDcEIsT0FBTyxJ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