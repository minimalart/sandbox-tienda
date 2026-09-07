export type CreateBrandStepInput = {
    name: string;
    handle: string;
    description?: string;
    is_active?: boolean;
    sales_channel_ids?: string[] | null;
    metadata?: Record<string, unknown>;
};
export declare const createBrandStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateBrandStepInput, {
    id: string;
    name: string;
    handle: string;
    description: string | null;
    is_active: boolean;
    sales_channel_ids: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    product_links: {
        id: string;
        product_id: string;
        brand: /*elided*/ any;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
        brand_id: string;
    }[];
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}>;
