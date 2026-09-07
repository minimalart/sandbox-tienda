import { CreateGa4MappingStepInput } from './steps/create-ga4-mapping';
export type CreateGa4MappingInput = CreateGa4MappingStepInput;
export declare const createGa4MappingWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<CreateGa4MappingStepInput, {
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
