export type ReverseLoyaltyPointsInput = {
    customer_id: string;
    reference?: string;
    reference_id: string;
};
export declare const reverseLoyaltyPointsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<ReverseLoyaltyPointsInput, {
    reversed: number;
}, []>;
