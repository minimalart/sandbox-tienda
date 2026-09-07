export declare const BannerAnalytics: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    banner_id: import("@medusajs/framework/utils").TextProperty;
    impressions: import("@medusajs/framework/utils").NumberProperty;
    clicks: import("@medusajs/framework/utils").NumberProperty;
    last_impression_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    last_click_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
}>, "banner_analytics">;
export default BannerAnalytics;
