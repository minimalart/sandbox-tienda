export type AggregateCommerceMetricsInput = {
    from: string;
    to: string;
    bucket?: 'daily' | 'hourly';
    currency_code?: string;
};
export declare const aggregateCommerceMetricsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<AggregateCommerceMetricsInput, {
    from: string;
    to: string;
    bucket: "daily" | "hourly";
}, []>;
