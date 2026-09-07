import type { UpdateLandingPageInput } from '../modules/landing-page/types';
export type UpdateLandingPageWorkflowInput = UpdateLandingPageInput & {
    id: string;
};
export declare const updateLandingPageWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<Partial<import("../modules/landing-page/types").CreateLandingPageInput> & {
    id: string;
}, any, []>;
