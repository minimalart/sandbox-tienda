/** Tipo de operación de imagen que originó la propuesta (PRD §12.2 / §12.3). */
export declare const ASSET_OPERATION_TYPES: readonly ["optimize", "to_webp", "compress", "resize", "normalize", "recreate", "lifestyle", "lifestyle_editable", "background", "generate_missing", "variation", "import_external"];
export type AssetOperationType = (typeof ASSET_OPERATION_TYPES)[number];
export declare const ASSET_PROPOSAL_STATUSES: readonly ["pending", "proposed", "accepted", "rejected", "applied", "error"];
/**
 * CatalogingAssetProposal — una propuesta de imagen (procesada o generada) para
 * un producto de la ejecución (PRD §24). Conserva referencia al asset original
 * y al generado; NUNCA reemplaza la imagen existente antes de la aprobación
 * (PRD §12.3). Las imágenes generadas se marcan como contenido generado.
 */
export declare const CatalogingAssetProposal: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
export default CatalogingAssetProposal;
