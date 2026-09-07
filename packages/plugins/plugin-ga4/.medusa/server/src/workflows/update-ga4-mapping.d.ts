import { UpdateGa4MappingStepInput } from './steps/update-ga4-mapping';
export type UpdateGa4MappingInput = UpdateGa4MappingStepInput;
export declare const updateGa4MappingWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<UpdateGa4MappingStepInput, {
    id: string;
    medusa_event: string;
    ga4_event_name: string;
    is_active: boolean;
    description: string | null;
    param_mappings: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    site_id: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}, []>;
