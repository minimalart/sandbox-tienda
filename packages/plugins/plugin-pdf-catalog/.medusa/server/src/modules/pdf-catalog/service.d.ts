export type HotspotInput = {
    type: 'product' | 'video' | 'text';
    page_index: number;
    pos_x: number;
    pos_y: number;
    product_id?: string | null;
    variant_id?: string | null;
    data?: Record<string, unknown> | null;
    sort_order?: number;
};
declare const PdfCatalogModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly PdfCatalog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
    readonly PdfCatalogHotspot: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        type: import("@medusajs/framework/utils").EnumProperty<["product", "video", "text"]>;
        page_index: import("@medusajs/framework/utils").NumberProperty;
        pos_x: import("@medusajs/framework/utils").NumberProperty;
        pos_y: import("@medusajs/framework/utils").NumberProperty;
        product_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        variant_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        data: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        sort_order: import("@medusajs/framework/utils").NumberProperty;
        catalog: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            name: import("@medusajs/framework/utils").TextProperty;
            pdf_url: import("@medusajs/framework/utils").TextProperty;
            pdf_file_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            pages: import("@medusajs/framework/utils").NumberProperty;
            published: import("@medusajs/framework/utils").BooleanProperty;
            metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            hotspots: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "pdf_catalog_hotspot">>;
            channels: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
                id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
                sales_channel_id: import("@medusajs/framework/utils").TextProperty;
                catalog: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "pdf_catalog">, undefined>;
            }>, "pdf_catalog_channel">>;
        }>, "pdf_catalog">, undefined>;
    }>, "pdf_catalog_hotspot">;
    readonly PdfCatalogChannel: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
}>>;
declare class PdfCatalogModuleService extends PdfCatalogModuleService_base {
    /**
     * Reemplaza por completo los hotspots de un catálogo por la lista dada.
     * (Igual que shop_by_look: enviar la lista pisa la anterior.)
     */
    replaceHotspots(catalogId: string, hotspots: HotspotInput[]): Promise<void>;
    /**
     * Reconcilia en qué sales channels este catálogo es EL activo.
     *
     * Invariante "uno activo por canal": para cada canal deseado que hoy pertenece
     * a otro catálogo, se le "roba" (se borra la fila viva ajena) antes de crear la
     * propia; los canales que dejan de estar en la lista se desactivan. El índice
     * UNIQUE parcial sobre sales_channel_id respalda la invariante a nivel DB.
     */
    reconcileChannels(catalogId: string, salesChannelIds: string[]): Promise<void>;
    /** Lista de sales_channel_ids donde este catálogo es el activo. */
    getActiveChannelIds(catalogId: string): Promise<string[]>;
}
export default PdfCatalogModuleService;
