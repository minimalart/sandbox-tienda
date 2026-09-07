/**
 * Estados funcionales de una ejecución (PRD §8). La transición la controla el
 * service; la UI y los workflows sólo leen/escriben estados válidos.
 */
export declare const EXECUTION_STATUSES: readonly ["draft", "generating", "pending_review", "partially_reviewed", "ready_to_apply", "applying", "applied", "partially_applied", "error", "cancelled", "restored"];
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
/** Tipo de ejecución: normal (enriquecimiento) o restauración de otra. */
export declare const EXECUTION_KINDS: readonly ["enrichment", "restoration"];
/**
 * CatalogingExecution — un proceso completo de enriquecimiento (PRD §7). Guarda
 * la selección exacta de productos, la config efectiva (con prompts congelados),
 * el avance y el resumen. Los cambios propuestos/aceptados viven en los productos
 * de la ejecución (cataloging_execution_product).
 */
export declare const CatalogingExecution: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    name: import("@medusajs/framework/utils").TextProperty;
    status: import("@medusajs/framework/utils").EnumProperty<["draft", "generating", "pending_review", "partially_reviewed", "ready_to_apply", "applying", "applied", "partially_applied", "error", "cancelled", "restored"]>;
    kind: import("@medusajs/framework/utils").EnumProperty<["enrichment", "restoration"]>;
    created_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    /**
     * La tienda desde la que se lanzó la corrida. `NULL` = anterior a la columna.
     *
     * OJO con lo que esto NO significa: el producto que la corrida enriquece es
     * COMPARTIDO por toda la instancia. Esto scopea el HISTORIAL —quién corrió qué y
     * cuándo—, que es lo que el operador de una tienda necesita ver sin el ruido de
     * las demás. El efecto sigue siendo global, y el listado lo dice.
     */
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
export default CatalogingExecution;
