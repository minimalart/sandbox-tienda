"use strict";
// Pure tier logic, isolated for unit testing. A customer's tier is derived from
// accumulated metrics (spend / points / orders) meeting a tier's threshold.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCustomerTier = computeCustomerTier;
exports.tierMultiplier = tierMultiplier;
exports.tierProgress = tierProgress;
function metricFor(tier, m) {
    if (tier.condition_type === 'spend')
        return m.spend;
    if (tier.condition_type === 'orders')
        return m.orders;
    return m.points;
}
// The best tier the customer qualifies for: among tiers whose threshold is met,
// the one with the highest threshold (multiplier breaks ties). null = none.
function computeCustomerTier(tiers, metrics) {
    const eligible = tiers.filter((t) => metricFor(t, metrics) >= (t.threshold || 0));
    if (!eligible.length)
        return null;
    eligible.sort((a, b) => b.threshold - a.threshold || (b.multiplier ?? 1) - (a.multiplier ?? 1));
    return eligible[0] ?? null;
}
function tierMultiplier(tier) {
    return tier && (tier.multiplier ?? 0) > 0 ? tier.multiplier : 1;
}
// Current tier + the next unmet tier and how much of its metric is missing.
function tierProgress(tiers, metrics) {
    const current = computeCustomerTier(tiers, metrics);
    const notMet = tiers
        .filter((t) => metricFor(t, metrics) < (t.threshold || 0))
        .sort((a, b) => a.threshold - b.threshold);
    const next = notMet[0] ?? null;
    return {
        current,
        next,
        toNext: next ? Math.max(0, next.threshold - metricFor(next, metrics)) : 0,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGllcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sb3lhbHR5L2xpYi90aWVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsZ0ZBQWdGO0FBQ2hGLDRFQUE0RTs7QUFvQjVFLGtEQUtDO0FBRUQsd0NBRUM7QUFHRCxvQ0FjQztBQWxDRCxTQUFTLFNBQVMsQ0FBQyxJQUFjLEVBQUUsQ0FBa0I7SUFDbkQsSUFBSSxJQUFJLENBQUMsY0FBYyxLQUFLLE9BQU87UUFBRSxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUM7SUFDcEQsSUFBSSxJQUFJLENBQUMsY0FBYyxLQUFLLFFBQVE7UUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDdEQsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxnRkFBZ0Y7QUFDaEYsNEVBQTRFO0FBQzVFLFNBQWdCLG1CQUFtQixDQUFDLEtBQWlCLEVBQUUsT0FBd0I7SUFDN0UsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU07UUFBRSxPQUFPLElBQUksQ0FBQztJQUNsQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRyxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUM7QUFDN0IsQ0FBQztBQUVELFNBQWdCLGNBQWMsQ0FBQyxJQUFxQjtJQUNsRCxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBRSxJQUFJLENBQUMsVUFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlFLENBQUM7QUFFRCw0RUFBNEU7QUFDNUUsU0FBZ0IsWUFBWSxDQUMxQixLQUFpQixFQUNqQixPQUF3QjtJQUV4QixNQUFNLE9BQU8sR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDcEQsTUFBTSxNQUFNLEdBQUcsS0FBSztTQUNqQixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ3pELElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUM7SUFDL0IsT0FBTztRQUNMLE9BQU87UUFDUCxJQUFJO1FBQ0osTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDMUUsQ0FBQztBQUNKLENBQUMifQ==