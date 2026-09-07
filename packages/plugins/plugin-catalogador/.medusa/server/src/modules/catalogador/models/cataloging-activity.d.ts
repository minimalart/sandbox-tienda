/**
 * Tipos de evento de auditoría (PRD §21 "Actividad" / §32 "Auditoría").
 * No es un enum estricto para permitir eventos futuros sin migración.
 */
export declare const ACTIVITY_TYPES: readonly ["created", "generation_started", "generation_completed", "regenerated", "reviewed", "edited", "apply_started", "applied", "apply_failed", "cancelled", "restored", "refloated", "duplicated", "error"];
/**
 * CatalogingActivity — registro append-only de acciones relevantes (PRD §32).
 * Anota usuario, fecha, producto/campo, acción, valores (anterior/propuesto/
 * aplicado) y herramienta/modelo usado en `metadata`.
 */
export declare const CatalogingActivity: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    execution_id: import("@medusajs/framework/utils").TextProperty;
    execution_product_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    actor_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    type: import("@medusajs/framework/utils").TextProperty;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "cataloging_activity">;
export default CatalogingActivity;
