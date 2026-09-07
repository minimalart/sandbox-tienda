/** Momento del snapshot respecto de la aplicación (PRD §19). */
export declare const SNAPSHOT_TYPES: readonly ["pre", "post"];
export type SnapshotType = (typeof SNAPSHOT_TYPES)[number];
/**
 * CatalogingSnapshot — estado exacto de los campos afectados de un producto,
 * antes (`pre`) y después (`post`) de aplicar (PRD §19). Guarda sólo lo
 * necesario para recuperar: valores textuales, relaciones, metadata, refs +
 * orden de imágenes, estado de publicación. Pertenece a la ejecución (no es una
 * sección independiente del menú, PRD §19.3).
 */
export declare const CatalogingSnapshot: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    execution_id: import("@medusajs/framework/utils").TextProperty;
    product_id: import("@medusajs/framework/utils").TextProperty;
    type: import("@medusajs/framework/utils").EnumProperty<["pre", "post"]>;
    data: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "cataloging_snapshot">;
export default CatalogingSnapshot;
