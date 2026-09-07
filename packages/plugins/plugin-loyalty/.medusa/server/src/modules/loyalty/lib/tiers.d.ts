export type TierLike = {
    id: string;
    name?: string;
    condition_type: 'spend' | 'points' | 'orders';
    threshold: number;
    multiplier?: number;
};
export type CustomerMetrics = {
    points: number;
    spend: number;
    orders: number;
};
export declare function computeCustomerTier(tiers: TierLike[], metrics: CustomerMetrics): TierLike | null;
export declare function tierMultiplier(tier: TierLike | null): number;
export declare function tierProgress(tiers: TierLike[], metrics: CustomerMetrics): {
    current: TierLike | null;
    next: TierLike | null;
    toNext: number;
};
