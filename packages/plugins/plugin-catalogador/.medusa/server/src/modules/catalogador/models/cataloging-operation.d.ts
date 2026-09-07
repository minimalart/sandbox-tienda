/** Familia de operación elegida en el Paso 2 del wizard (PRD §12). */
export declare const OPERATION_TYPES: readonly ["text_field", "image_technical", "image_ai"];
export type OperationType = (typeof OPERATION_TYPES)[number];
export declare const OPERATION_STATUSES: readonly ["pending", "running", "done", "error"];
export type OperationStatus = (typeof OPERATION_STATUSES)[number];
/**
 * CatalogingOperation — una operación (campo/transformación) seleccionada para
 * la ejecución (PRD §24). `field` identifica el campo de texto (p.ej.
 * 'description', 'meta_title', 'categories') o la operación de imagen
 * (p.ej. 'to_webp', 'lifestyle'). `configuration` guarda parámetros específicos.
 */
export declare const CatalogingOperation: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    execution_id: import("@medusajs/framework/utils").TextProperty;
    type: import("@medusajs/framework/utils").EnumProperty<["text_field", "image_technical", "image_ai"]>;
    field: import("@medusajs/framework/utils").TextProperty;
    configuration: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    status: import("@medusajs/framework/utils").EnumProperty<["pending", "running", "done", "error"]>;
}>, "cataloging_operation">;
export default CatalogingOperation;
