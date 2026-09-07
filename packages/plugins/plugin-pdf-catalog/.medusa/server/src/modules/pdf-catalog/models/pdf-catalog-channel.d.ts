/**
 * PdfCatalogChannel — activación de un catálogo en un sales channel.
 *
 * Invariante del feature: "una sola activa por sales channel". Se garantiza con
 * un índice UNIQUE parcial sobre `sales_channel_id` (ver migración): activar un
 * catálogo en un canal ya ocupado "roba" el canal (reconciliación en el
 * workflow), y la DB impide dos filas vivas para el mismo canal.
 */
export declare const PdfCatalogChannel: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    sales_channel_id: import("@medusajs/framework/utils").TextProperty;
    catalog: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        name: import("@medusajs/framework/utils").TextProperty;
        pdf_url: import("@medusajs/framework/utils").TextProperty;
        pdf_file_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        pages: import("@medusajs/framework/utils").NumberProperty;
        published: import("@medusajs/framework/utils").BooleanProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        hotspots: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            type: import("@medusajs/framework/utils").EnumProperty<["product", "video", "text"]>;
            page_index: import("@medusajs/framework/utils").NumberProperty;
            pos_x: import("@medusajs/framework/utils").NumberProperty;
            pos_y: import("@medusajs/framework/utils").NumberProperty;
            product_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            variant_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            data: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            sort_order: import("@medusajs/framework/utils").NumberProperty;
            catalog: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "pdf_catalog">, undefined>;
        }>, "pdf_catalog_hotspot">>;
        channels: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "pdf_catalog_channel">>;
    }>, "pdf_catalog">, undefined>;
}>, "pdf_catalog_channel">;
