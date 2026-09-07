/**
 * BlogCategory — a taxonomy bucket for articles. Public URL: /blog/categoria/{slug}.
 * `image` is a { url, file_id, alt } JSON; `sort_order` drives menu ordering.
 */
export declare const BlogCategory: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    name: import("@medusajs/framework/utils").TextProperty;
    slug: import("@medusajs/framework/utils").TextProperty;
    description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    image: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    sort_order: import("@medusajs/framework/utils").NumberProperty;
    /**
     * La tienda dueña de la categoría. `NULL` = taxonomía compartida.
     *
     * `empty: 'all'` en el descriptor: las existentes son de todas, y esconderlas
     * dejaría posts publicados apuntando a una categoría que el operador no ve.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "blog_category">;
export default BlogCategory;
