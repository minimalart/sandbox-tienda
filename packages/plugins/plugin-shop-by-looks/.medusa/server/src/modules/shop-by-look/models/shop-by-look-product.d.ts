/**
 * ShopByLookProduct — un producto asociado a un look + su hotspot.
 *
 * `product_id` se guarda como texto (no hay defineLink): el storefront resuelve
 * el producto por la store API, así si el producto se borra el look no se rompe.
 * `variant_id` es opcional: si falta, el usuario elige la variante en storefront.
 * `pos_x` / `pos_y` son porcentajes enteros (0–100) sobre la imagen.
 */
export declare const ShopByLookProduct: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    product_id: import("@medusajs/framework/utils").TextProperty;
    variant_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    pos_x: import("@medusajs/framework/utils").NumberProperty;
    pos_y: import("@medusajs/framework/utils").NumberProperty;
    sort_order: import("@medusajs/framework/utils").NumberProperty;
    look: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        title: import("@medusajs/framework/utils").TextProperty;
        subtitle: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        cta_label: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        image_url: import("@medusajs/framework/utils").TextProperty;
        image_alt: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        is_active: import("@medusajs/framework/utils").BooleanProperty;
        sort_order: import("@medusajs/framework/utils").NumberProperty;
        placement: import("@medusajs/framework/utils").TextProperty;
        sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        region_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        products: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "shop_by_look_product">>;
    }>, "shop_by_look">, undefined>;
}>, "shop_by_look_product">;
