/**
 * PdfCatalog — un catálogo/revista en PDF navegable como flipbook, con hotspots
 * interactivos encima (producto / video / texto).
 *
 * Se pueden crear varios, pero por cada sales channel hay a lo sumo UNO activo:
 * la exclusividad vive en `PdfCatalogChannel` (unique por sales_channel_id), no
 * acá. `published` es un gate independiente: un catálogo debe estar publicado Y
 * activo en el canal para verse en el storefront.
 */
export declare const PdfCatalog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
    channels: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        sales_channel_id: import("@medusajs/framework/utils").TextProperty;
        catalog: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "pdf_catalog">, undefined>;
    }>, "pdf_catalog_channel">>;
}>, "pdf_catalog">;
