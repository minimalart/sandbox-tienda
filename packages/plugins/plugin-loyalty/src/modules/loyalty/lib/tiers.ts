// Pure tier logic, isolated for unit testing. A customer's tier is derived from
// accumulated metrics (spend / points / orders) meeting a tier's threshold.

export type TierLike = {
  id: string;
  name?: string;
  condition_type: 'spend' | 'points' | 'orders';
  threshold: number;
  multiplier?: number;
};

export type CustomerMetrics = { points: number; spend: number; orders: number };

function metricFor(tier: TierLike, m: CustomerMetrics): number {
  if (tier.condition_type === 'spend') return m.spend;
  if (tier.condition_type === 'orders') return m.orders;
  return m.points;
}

// The best tier the customer qualifies for: among tiers whose threshold is met,
// the one with the highest threshold (multiplier breaks ties). null = none.
export function computeCustomerTier(tiers: TierLike[], metrics: CustomerMetrics): TierLike | null {
  const eligible = tiers.filter((t) => metricFor(t, metrics) >= (t.threshold || 0));
  if (!eligible.length) return null;
  eligible.sort((a, b) => b.threshold - a.threshold || (b.multiplier ?? 1) - (a.multiplier ?? 1));
  return eligible[0] ?? null;
}

export function tierMultiplier(tier: TierLike | null): number {
  return tier && (tier.multiplier ?? 0) > 0 ? (tier.multiplier as number) : 1;
}

// Current tier + the next unmet tier and how much of its metric is missing.
export function tierProgress(
  tiers: TierLike[],
  metrics: CustomerMetrics,
): { current: TierLike | null; next: TierLike | null; toNext: number } {
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
