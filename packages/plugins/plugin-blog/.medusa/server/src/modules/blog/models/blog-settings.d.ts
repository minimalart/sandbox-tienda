/**
 * BlogSettings — a single-row configuration record for the Blog section.
 * Holds presentation toggles + default SEO. Kept as its own table (rather than
 * overloading store-config) so the blog module stays self-contained.
 */
export declare const BlogSettings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    section_name: import("@medusajs/framework/utils").TextProperty;
    show_search: import("@medusajs/framework/utils").BooleanProperty;
    show_categories: import("@medusajs/framework/utils").BooleanProperty;
    posts_per_page: import("@medusajs/framework/utils").NumberProperty;
    default_seo_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    default_seo_description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, el
     * fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: la unicidad pasa a ser por tienda y necesita DOS
     * índices parciales, porque en Postgres `NULL != NULL`.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "blog_settings">;
export default BlogSettings;
