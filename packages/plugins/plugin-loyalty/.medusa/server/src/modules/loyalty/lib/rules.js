"use strict";
// Pure earn-rule evaluation, isolated from the DB for unit testing.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRuleApplicable = isRuleApplicable;
exports.pickCampaignMultiplier = pickCampaignMultiplier;
exports.capByLimits = capByLimits;
exports.computeExpiryAt = computeExpiryAt;
// Does an earn rule apply to this event context?
function isRuleApplicable(rule, ctx) {
    if (rule.status && rule.status !== 'active')
        return false;
    const c = rule.conditions ?? {};
    if (c.min_amount != null && ctx.amount < c.min_amount)
        return false;
    if (c.starts_at && ctx.now < Date.parse(c.starts_at))
        return false;
    if (c.ends_at && ctx.now > Date.parse(c.ends_at))
        return false;
    if (Array.isArray(c.sales_channel_ids) && c.sales_channel_ids.length) {
        if (!ctx.sales_channel_id || !c.sales_channel_ids.includes(ctx.sales_channel_id))
            return false;
    }
    if (Array.isArray(c.customer_ids) && c.customer_ids.length) {
        if (!c.customer_ids.includes(ctx.customer_id))
            return false;
    }
    // Catalog gates: if set, require at least one overlap with the order's items.
    const overlaps = (want, have) => !Array.isArray(want) || want.length === 0 || (have ?? []).some((id) => want.includes(id));
    if (!overlaps(c.category_ids, ctx.category_ids))
        return false;
    if (!overlaps(c.collection_ids, ctx.collection_ids))
        return false;
    if (!overlaps(c.brand_ids, ctx.brand_ids))
        return false;
    return true;
}
// The multiplier from the highest-priority active campaign that affects a rule.
// `affected_rule_ids` empty/absent = affects all rules. Returns 1 if none apply.
function pickCampaignMultiplier(campaigns, ruleId, now) {
    let mult = 1;
    let bestPriority = -Infinity;
    for (const cm of campaigns) {
        if (cm.status && cm.status !== 'active')
            continue;
        if (cm.starts_at && now < Date.parse(cm.starts_at))
            continue;
        if (cm.ends_at && now > Date.parse(cm.ends_at))
            continue;
        const list = cm.affected_rule_ids;
        const affects = !Array.isArray(list) || list.length === 0 || list.includes(ruleId);
        if (!affects)
            continue;
        const priority = cm.priority ?? 0;
        if (priority > bestPriority) {
            bestPriority = priority;
            mult = cm.multiplier && cm.multiplier > 0 ? cm.multiplier : 1;
        }
    }
    return mult > 0 ? mult : 1;
}
// Cap requested points by per-customer / per-day limits given already-earned totals.
function capByLimits(limits, requested, lifetimeEarned, todayEarned) {
    let pts = requested;
    if (limits?.per_customer != null) {
        pts = Math.min(pts, Math.max(0, limits.per_customer - lifetimeEarned));
    }
    if (limits?.per_day != null) {
        pts = Math.min(pts, Math.max(0, limits.per_day - todayEarned));
    }
    return Math.max(0, pts);
}
// When points earned `now` should expire, per the program policy. null = never.
function computeExpiryAt(policy, now) {
    if (!policy || !policy.type || policy.type === 'none')
        return null;
    if (policy.type === 'fixed_days' && policy.days && policy.days > 0) {
        return new Date(now + policy.days * 86_400_000);
    }
    if (policy.type === 'end_of_year') {
        const year = new Date(now).getUTCFullYear();
        return new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVsZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sb3lhbHR5L2xpYi9ydWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsb0VBQW9FOztBQThDcEUsNENBdUJDO0FBSUQsd0RBcUJDO0FBR0Qsa0NBY0M7QUFLRCwwQ0FVQztBQWpGRCxpREFBaUQ7QUFDakQsU0FBZ0IsZ0JBQWdCLENBQUMsSUFBbUIsRUFBRSxHQUFnQjtJQUNwRSxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxRQUFRO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDMUQsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUM7SUFFaEMsSUFBSSxDQUFDLENBQUMsVUFBVSxJQUFJLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxVQUFVO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDcEUsSUFBSSxDQUFDLENBQUMsU0FBUyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDbkUsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFFL0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNyRSxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUM7WUFBRSxPQUFPLEtB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