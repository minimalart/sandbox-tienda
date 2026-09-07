/**
 * LandingPage — a visually-built marketing page authored with the Puck editor.
 *
 * - `puck_data`: the editor's native JSON ({ content, root }). Source of truth
 *   for rendering — never raw HTML, so the storefront renderer stays controlled
 *   by our own component mapping.
 * - `seo`: { title, description, image, noindex }.
 * - `status`: 'draft' | 'published' | 'archived'.
 *
 * Mirrors the Banner module's JSON-field approach (content/media/cta/rules).
 */
export declare const LandingPage: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    title: import("@medusajs/framework/utils").TextProperty;
    slug: import("@medusajs/framework/utils").TextProperty;
    status: import("@medusajs/framework/utils").TextProperty;
    description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    seo: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    puck_data: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    template: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    locale: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    published_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    created_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    updated_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "landing_page">;
export default LandingPage;
