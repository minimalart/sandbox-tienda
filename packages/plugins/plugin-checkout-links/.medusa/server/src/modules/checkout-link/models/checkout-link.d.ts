/**
 * A preloaded checkout link. The operator authors one of these from the admin
 * (products, optional customer data, promos, expiry) and shares the resulting
 * public URL `/{country}/c/{token}`. The token is opaque; PII (email/address)
 * lives here in the DB, never in the URL.
 */
export declare const CheckoutLink: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    token: import("@medusajs/framework/utils").TextProperty;
    internal_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    items: import("@medusajs/framework/utils").JSONProperty;
    country_code: import("@medusajs/framework/utils").TextProperty;
    region_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    email: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    shipping_address: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    promo_codes: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    status: import("@medusajs/framework/utils").TextProperty;
    single_use: import("@medusajs/framework/utils").BooleanProperty;
    used_count: import("@medusajs/framework/utils").NumberProperty;
    expires_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    created_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "checkout_link">;
