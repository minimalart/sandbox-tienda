import type { UpdateBannerInput } from '../modules/banner/types';
type UpdateBannerWorkflowInput = {
    id: string;
    data: UpdateBannerInput;
    user_id?: string;
};
export declare const updateBannerWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<UpdateBannerWorkflowInput, any, []>;
export {};
