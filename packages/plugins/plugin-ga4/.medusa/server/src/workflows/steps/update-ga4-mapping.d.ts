import { Ga4ParamMappingInput } from './create-ga4-mapping';
export type UpdateGa4MappingStepInput = {
    id: string;
    medusa_event?: string;
    ga4_event_name?: string;
    is_active?: boolean;
    description?: string;
    param_mappings?: Ga4ParamMappingInput[];
    metadata?: Record<string, unknown>;
};
export declare const updateGa4MappingStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateGa4MappingStepInput, {
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
}>;
