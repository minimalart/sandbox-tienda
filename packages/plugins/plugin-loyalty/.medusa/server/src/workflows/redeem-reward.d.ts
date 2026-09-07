export type RedeemRewardInput = {
    customer_id: string;
    reward_id: string;
    redemption_ref: string;
    sales_channel_id?: string | null;
};
export declare const redeemRewardWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<RedeemRewardInput, {
    grant: Record<string, any>;
    already: boolean;
}, []>;
