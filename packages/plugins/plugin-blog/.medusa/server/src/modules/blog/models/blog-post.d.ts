/**
 * BlogPost — an editorial article authored with the Tiptap editor.
 *
 * - `content`: Tiptap's native JSON document. Source of truth for rendering;
 *   the storefront converts it to sanitized HTML server-side (SEO-friendly SSR).
 * - `cover_image`: { url, file_id, alt } JSON (mirrors the brand-image shape).
 * - `seo_title` / `seo_description`: per-article SEO overrides.
 * - `status`: 'draft' | 'published'. Drafts are never exposed publicly.
 *
 * Related products are stored out-of-band in `blog_post_product` (a separate
 * link table) so the catalog is referenced by id, never embedded in content.
 */
export declare const BlogPost: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    title: import("@medusajs/framework/utils").TextProperty;
    slug: import("@medusajs/framework/utils").TextProperty;
    excerpt: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    cover_image: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    content: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    status: import("@medusajs/framework/utils").TextProperty;
    category_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    seo_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    seo_description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    published_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "blog_post">;
export default BlogPost;
