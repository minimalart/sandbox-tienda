/**
 * BlogPostProduct — ordered association between a blog post and a catalog
 * product. `product_id` is a plain text column (no FK to the product table),
 * mirroring the vimeo-video `product_video_link` approach; products are
 * hydrated from the store products endpoint by id. `sort_order` preserves the
 * admin's drag & drop ordering.
 */
export declare const BlogPostProduct: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    blog_post_id: import("@medusajs/framework/utils").TextProperty;
    product_id: import("@medusajs/framework/utils").TextProperty;
    sort_order: import("@medusajs/framework/utils").NumberProperty;
}>, "blog_post_product">;
export default BlogPostProduct;
