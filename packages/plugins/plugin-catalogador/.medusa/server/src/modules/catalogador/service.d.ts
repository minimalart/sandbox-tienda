import { type ExecutionStatus, type OperationStatus } from './models';
/** Progreso agregado que la lista/detalle muestran (PRD §14.2). */
export type ExecutionProgress = {
    total: number;
    processed: number;
    proposed: number;
    no_changes: number;
    warnings: number;
    failed: number;
    percent: number;
};
declare const CatalogadorModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly CatalogingExecution: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        name: import("@medusajs/framework/utils").TextProperty;
        status: import("@medusajs/framework/utils").EnumProperty<["draft", "generating", "pending_review", "partially_reviewed", "ready_to_apply", "applying", "applied", "partially_applied", "error", "cancelled", "restored"]>;
        kind: import("@medusajs/framework/utils").EnumProperty<["enrichment", "restoration"]>;
        created_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        generation_started_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        generation_completed_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        apply_started_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        applied_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        cancelled_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        restored_from_execution_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        duplicated_from_execution_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        configuration_snapshot: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        selection_definition: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        selection_count: import("@medusajs/framework/utils").NumberProperty;
        ai_cost_usd: import("@medusajs/framework/utils").FloatProperty;
        ai_usage: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        progress: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        summary: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        error_summary: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "cataloging_execution">;
    readonly CatalogingExecutionProduct: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        execution_id: import("@medusajs/framework/utils").TextProperty;
        product_id: import("@medusajs/framework/utils").TextProperty;
        status: import("@medusajs/framework/utils").EnumProperty<["pending", "generating", "proposed", "no_changes", "accepted", "rejected", "excluded", "applied", "apply_failed", "error"]>;
        product_version_reference: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        current_snapshot: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        proposed_changes: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        accepted_changes: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        rejected_changes: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        warnings: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        errors: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        ai_cost_usd: import("@medusajs/framework/utils").FloatProperty;
        ai_usage: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        external_context_summary: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        generation_attempts: import("@medusajs/framework/utils").NumberProperty;
    }>, "cataloging_execution_product">;
    readonly CatalogingOperation: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        execution_id: import("@medusajs/framework/utils").TextProperty;
        type: import("@medusajs/framework/utils").EnumProperty<["text_field", "image_technical", "image_ai"]>;
        field: import("@medusajs/framework/utils").TextProperty;
        configuration: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        status: import("@medusajs/framework/utils").EnumProperty<["pending", "running", "done", "error"]>;
    }>, "cataloging_operation">;
    readonly CatalogingAssetProposal: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        execution_product_id: import("@medusajs/framework/utils").TextProperty;
        source_asset_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        generated_asset_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        operation_type: import("@medusajs/framework/utils").EnumProperty<["optimize", "to_webp", "compress", "resize", "normalize", "recreate", "lifestyle", "lifestyle_editable", "background", "generate_missing", "variation", "import_external"]>;
        status: import("@medusajs/framework/utils").EnumProperty<["pending", "proposed", "accepted", "rejected", "applied", "error"]>;
        is_ai_generated: import("@medusajs/framework/utils").BooleanProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        generation_provider: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        generation_model: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "cataloging_asset_proposal">;
    readonly CatalogingSnapshot: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        execution_id: import("@medusajs/framework/utils").TextProperty;
        product_id: import("@medusajs/framework/utils").TextProperty;
        type: import("@medusajs/framework/utils").EnumProperty<["pre", "post"]>;
        data: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "cataloging_snapshot">;
    readonly CatalogingActivity: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        execution_id: import("@medusajs/framework/utils").TextProperty;
        execution_product_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        actor_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        type: import("@medusajs/framework/utils").TextProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "cataloging_activity">;
}>>;
declare class CatalogadorModuleService extends CatalogadorModuleService_base {
    /** ¿La ejecución puede eliminarse? (sólo borradores/canceladas/error) */
    isDeletable(status: ExecutionStatus): boolean;
    /**
     * Registra un evento de auditoría (append-only). Best-effort: nunca rompe el
     * flujo llamador (PRD §32).
     */
    logActivity(input: {
        execution_id: string;
        type: string;
        execution_product_id?: string | null;
        actor_id?: string | null;
        metadata?: Record<string, unknown> | null;
    }): Promise<void>;
    /**
     * Recalcula el progreso de una ejecución a partir del estado de sus productos
     * y lo persiste en `progress`. Devuelve el agregado.
     *
     * Aprovecha el mismo listado para reagregar el costo de IA de la ejecución
     * (suma de sus productos): así el total nunca se desincroniza, sin importar
     * qué camino generó/regeneró propuestas.
     */
    recomputeProgress(executionId: string): Promise<ExecutionProgress>;
    /**
     * Mueve TODAS las operaciones de una corrida a un estado.
     *
     * `cataloging_operation.status` nacía en `pending` por el default del modelo y
     * `updateCatalogingOperations` —que `MedusaService` genera— no se llamaba en
     * ningún lado del repo: la columna era decorativa y decía `pending` para
     * siempre, incluso con la generación al 100% y los 40 productos procesados sin
     * un error. No era una transición mal hecha; la transición no estaba escrita.
     *
     * Best-effort a propósito, igual que `logActivity`: es metadata de progreso, y
     * no vale tirar una generación o un apply que sí funcionaron porque no se pudo
     * estampar el estado de la operación.
     */
    setOperationsStatus(executionId: string, status: OperationStatus): Promise<void>;
    /**
     * Transición de estado con timestamps de ciclo de vida (PRD §7/§8). No valida
     * el grafo de transiciones (lo hacen los endpoints/workflows); centraliza el
     * estampado de fechas.
     */
    setStatus(executionId: string, status: ExecutionStatus): Promise<void>;
}
export default CatalogadorModuleService;
