declare const WishlistModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly Wishlist: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        customer_id: import("@medusajs/framework/utils").TextProperty;
        items: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            product_id: import("@medusajs/framework/utils").TextProperty;
            product_variant_id: import("@medusajs/framework/utils").TextProperty;
            quantity: import("@medusajs/framework/utils").NumberProperty;
            wishlist: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "wishlist">, undefined>;
        }>, "wishlist_item">>;
    }>, "wishlist">;
    readonly WishlistItem: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        product_id: import("@medusajs/framework/utils").TextProperty;
        product_variant_id: import("@medusajs/framework/utils").TextProperty;
        quantity: import("@medusajs/framework/utils").NumberProperty;
        wishlist: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            customer_id: import("@medusajs/framework/utils").TextProperty;
            items: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "wishlist_item">>;
        }>, "wishlist">, undefined>;
    }>, "wishlist_item">;
}>>;
declare class WishlistModuleService extends WishlistModuleService_base {
}
export default WishlistModuleService;
