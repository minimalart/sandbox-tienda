export declare const GiftCardDesign: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    public_id: import("@medusajs/framework/utils").TextProperty;
    name: import("@medusajs/framework/utils").TextProperty;
    occasion: import("@medusajs/framework/utils").EnumProperty<["general", "birthday", "thanks", "congratulations", "holidays", "brand"]>;
    desktop_image_url: import("@medusajs/framework/utils").TextProperty;
    mobile_image_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    text_color: import("@medusajs/framework/utils").TextProperty;
    content_position: import("@medusajs/framework/utils").EnumProperty<["top_left", "top_center", "top_right", "center_left", "center", "center_right", "bottom_left", "bottom_center", "bottom_right"]>;
    active: import("@medusajs/framework/utils").BooleanProperty;
    sort_order: import("@medusajs/framework/utils").NumberProperty;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    /**
     * La tienda dueña del diseño. `NULL` = diseño GLOBAL, disponible en todas.
     *
     * Es branding: la tarjeta lleva la marca de la tienda que la vende. Un diseño sin
     * tienda es de la instancia —el `brand-default` sembrado— y por eso `empty: 'all'`:
     * esconderlo dejaría a una tienda sin ningún diseño disponible.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "gift_card_design">;
