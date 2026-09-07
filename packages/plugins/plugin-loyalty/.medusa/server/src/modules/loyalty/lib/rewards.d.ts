export type RewardType = 'fixed_discount' | 'percent_discount' | 'free_shipping' | 'free_product' | 'store_credit' | 'custom';
export type RewardLike = {
    status?: string;
    stock?: number | null;
    valid_from?: string | null;
    valid_to?: string | null;
    cost_points?: number;
    type?: RewardType;
    config?: {
        value?: number;
        currency_code?: string;
        product_id?: string;
    } | null;
};
export declare function rewardRedeemability(reward: RewardLike, now: number): {
    ok: boolean;
    reason?: string;
};
export declare function benefitTypeFor(type: RewardType): 'promotion' | 'store_credit' | 'none';
export declare function buildPromotionInput(reward: RewardLike, code: string, currencyCode: string, salesChannelId?: string | null): Record<string, unknown> | null;
