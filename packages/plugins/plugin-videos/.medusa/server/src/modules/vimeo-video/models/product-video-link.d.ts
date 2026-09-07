export declare const ProductVideoLink: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    product_id: import("@medusajs/framework/utils").TextProperty;
    vimeo_video: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        vimeo_id: import("@medusajs/framework/utils").TextProperty;
        vimeo_uri: import("@medusajs/framework/utils").TextProperty;
        title: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        thumbnail_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        poster_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        vimeo_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        duration: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        status: import("@medusajs/framework/utils").EnumProperty<["uploading", "transcoding", "processing", "available", "error", "quota_exceeded", "total_cap_exceeded", "transcode_starting", "unavailable"]>;
        is_active: import("@medusajs/framework/utils").BooleanProperty;
        show_in_carousel: import("@medusajs/framework/utils").BooleanProperty;
        sort_order: import("@medusajs/framework/utils").NumberProperty;
        sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        product_links: import("@medusajs/framework/utils").HasMany<() => typeof ProductVideoLink>;
    }>, "vimeo_video">, undefined>;
}>, "product_video_link">;
