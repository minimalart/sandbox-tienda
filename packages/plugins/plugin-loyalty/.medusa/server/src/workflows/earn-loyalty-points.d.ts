export type EarnLoyaltyPointsInput = {
    customer_id: string;
    event: 'purchase' | 'signup' | 'first_purchase' | 'order_delivered' | 'birthday' | 'referral' | 'comment';
    amount?: number;
    reference?: string | null;
    reference_id?: string | null;
    sales_channel_id?: string | null;
    category_ids?: string[];
    collection_ids?: string[];
    brand_ids?: string[];
};
type Awarded = {
    customer_id: string;
    points: number;
    idempotency_key: string;
};
export declare const earnLoyaltyPointsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<EarnLoyaltyPointsInput, {
    awarded: Awarded[];
}, []>;
export {};
