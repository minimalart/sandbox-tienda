type DeleteBannerWorkflowInput = {
    id: string;
    user_id?: string;
};
export declare const deleteBannerWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<DeleteBannerWorkflowInput, {
    id: string;
    object: string;
    deleted: boolean;
}, []>;
export {};
