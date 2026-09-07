"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.earnLoyaltyPointsWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const loyalty_1 = require("../modules/loyalty");
const points_1 = require("../modules/points");
const earn_1 = require("../modules/loyalty/lib/earn");
const rules_1 = require("../modules/loyalty/lib/rules");
const tiers_1 = require("../modules/loyalty/lib/tiers");
const metrics_1 = require("../modules/loyalty/lib/metrics");
// Evaluates the active program's earn rules for the event, applies the best
// active campaign multiplier and per-customer/day limits, and writes idempotent
// ledger entries. Compensation reverses every entry it wrote, so a downstream
// failure never leaves points credited.
const awardStep = (0, workflows_sdk_1.createStep)('loyalty-award-points', async (input, { container }) => {
    const loyalty = container.resolve(loyalty_1.LOYALTY_MODULE);
    const points = container.resolve(points_1.POINTS_MODULE);
    const awarded = [];
    const program = await loyalty.getActiveProgram();
    if (!program)
        return new workflows_sdk_1.StepResponse({ awarded }, { awarded });
    const now = Date.now();
    const starts = program.starts_at ? new Date(program.starts_at).getTime() : null;
    const ends = program.ends_at ? new Date(program.ends_at).getTime() : null;
    if ((starts && now < starts) || (ends && now > ends)) {
        return new workflows_sdk_1.StepResponse({ awarded }, { awarded });
    }
    const rules = (await loyalty.listEarnRules({
        program_id: program.id,
        event: input.event,
        status: 'active',
    }));
    if (!rules.length)
        return new workflows_sdk_1.StepResponse({ awarded }, { awarded });
    const campaigns = (await loyalty.listCampaigns({
        program_id: program.id,
        status: 'active',
    }));
    // Tier multiplier (VIP levels). Only gather metrics when tiers exist.
    let tierMult = 1;
    const tiers = (await loyalty.listTiers({ program_id: program.id }));
    if (tiers.length) {
        const metrics = await (0, metrics_1.gatherCustomerMetrics)(container, input.customer_id);
        tierMult = (0, tiers_1.tierMultiplier)((0, tiers_1.computeCustomerTier)(tiers, metrics));
    }
    const amount = Number(input.amount) || 0;
    const expiresAt = (0, rules_1.computeExpiryAt)(program.expiration_policy ?? null, now);
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
        if (!(0, rules_1.isRuleApplicable)(rule, ctx))
            continue;
        const campaignMult = (0, rules_1.pickCampaignMultiplier)(campaigns, rule.id, now);
        let pts = (0, earn_1.computeEarnedPoints)(rule, amount, campaignMult * tierMult);
        if (pts <= 0)
            continue;
        const limits = rule.limits;
        if (limits && (limits.per_customer != null || limits.per_day != null)) {
            const priorEarns = (await points.listPointsTransactions({
                account_id: account.id,
                earn_rule_id: rule.id,
                type: 'earn',
            }));
            const lifetimeEarned = priorEarns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const todayEarned = priorEarns
                .filter((t) => new Date(t.created_at).getTime() >= startOfDay.getTime())
                .reduce((s, t) => s + (Number(t.amount) || 0), 0);
            pts = (0, rules_1.capByLimits)(limits, pts, lifetimeEarned, todayEarned);
        }
        if (pts <= 0)
            continue;
        const idempotency_key = `earn:${input.event}:${input.reference_id ?? 'na'}:${rule.id}`;
        const res = await points.earnPoints(input.customer_id, pts, {
            reference: input.reference ?? input.event,
            reference_id: input.reference_id ?? null,
            idempotency_key,
            program_id: program.id,
            earn_rule_id: rule.id,
            expires_at: expiresAt,
        });
        if (res)
            awarded.push({ customer_id: input.customer_id, points: pts, idempotency_key });
    }
    return new workflows_sdk_1.StepResponse({ awarded }, { awarded });
}, async (data, { container }) => {
    if (!data?.awarded?.length)
        return;
    const points = container.resolve(points_1.POINTS_MODULE);
    for (const a of data.awarded) {
        await points.reversePoints(a.customer_id, a.points, {
            reference: 'earn_compensation',
            idempotency_key: `reverse:${a.idempotency_key}`,
        });
    }
});
exports.earnLoyaltyPointsWorkflow = (0, workflows_sdk_1.createWorkflow)('earn-loyalty-points', (input) => {
    return new workflows_sdk_1.WorkflowResponse(awardStep(input));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWFybi1sb3lhbHR5LXBvaW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvZWFybi1sb3lhbHR5LXBvaW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsZ0RBQW9EO0FBRXBELDhDQUFrRDtBQUVsRCxzREFBa0U7QUFDbEUsd0RBS3NDO0FBQ3RDLHdEQUFtRjtBQUNuRiw0REFBdUU7QUFnQnZFLDRFQUE0RTtBQUM1RSxnRkFBZ0Y7QUFDaEYsOEVBQThFO0FBQzlFLHdDQUF3QztBQUN4QyxNQUFNLFNBQVMsR0FBRyxJQUFBLDBCQUFVLEVBQzFCLHNCQUFzQixFQUN0QixLQUFLLEVBQUUsS0FBNkIsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDckQsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQXNCLHNCQUFhLENBQUMsQ0FBQztJQUNyRSxNQUFNLE9BQU8sR0FBYyxFQUFFLENBQUM7SUFFOUIsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUNqRCxJQUFJLENBQUMsT0FBTztRQUFFLE9BQU8sSUFBSSw0QkFBWSxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBRWhFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUN2QixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBbUIsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDMUYsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFD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