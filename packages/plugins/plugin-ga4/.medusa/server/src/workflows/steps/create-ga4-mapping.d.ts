export type Ga4ParamMappingInput = {
    ga4_param: string;
    source_path?: string;
    static_value?: unknown;
};
export type CreateGa4MappingStepInput = {
    medusa_event: string;
    ga4_event_name: string;
    is_active?: boolean;
    description?: string;
    param_mappings?: Ga4ParamMappingInput[];
    metadata?: Record<string, unknown>;
    /**
     * La tienda dueña del mapeo. `null` = GLOBAL.
     *
     * Acá alcanza con tiparlo porque el step hace `...input`. En los workflows que arman
     * el objeto campo por campo hay que enumerarlo además, si no se descarta en silencio
     * — pasó cinco veces en esta migración.
     */
    site_id?: string | null;
};
export declare const createGa4MappingStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateGa4MappingStepInput, {
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
