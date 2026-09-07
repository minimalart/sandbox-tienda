export declare const VimeoToken: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    access_token: import("@medusajs/framework/utils").TextProperty;
    refresh_token: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    token_type: import("@medusajs/framework/utils").TextProperty;
    scope: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    expires_at: import("@medusajs/framework/utils").DateTimeProperty;
    user_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "vimeo_token">;
