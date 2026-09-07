/** Estado de revisión/generación de un producto dentro de la ejecución. */
export declare const EXECUTION_PRODUCT_STATUSES: readonly ["pending", "generating", "proposed", "no_changes", "accepted", "rejected", "excluded", "applied", "apply_failed", "error"];
export type ExecutionProductStatus = (typeof EXECUTION_PRODUCT_STATUSES)[number];
/**
 * CatalogingExecutionProduct — un producto seleccionado dentro de una ejecución
 * (PRD §24). Persiste el snapshot de los valores al generar (para detectar
 * cambios concurrentes al aplicar, PRD §18.4) y las propuestas por campo.
 *
 * Relación con la ejecución vía `execution_id` (text FK, no relación MikroORM,
 * para mantener migraciones y CRUD simples).
 */
export declare const CatalogingExecutionProduct: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
export default CatalogingExecutionProduct;
