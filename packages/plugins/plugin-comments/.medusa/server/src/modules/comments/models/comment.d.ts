/**
 * Comment — generic, reusable comment/review attached to any commentable entity
 * (product, blog post) via a polymorphic (commentable_type, commentable_id)
 * pair, NOT a foreign key — same approach as blog-post-product.ts. Supports one
 * level of nesting through `parent_id` (replies). Depending on the global
 * `review_mode` (see CommentSettings) it may carry a `rating`, a `content`, or
 * both.
 */
export declare const Comment: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    commentable_type: import("@medusajs/framework/utils").EnumProperty<["product", "blog_post"]>;
    commentable_id: import("@medusajs/framework/utils").TextProperty;
    parent_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    customer_id: import("@medusajs/framework/utils").TextProperty;
    author_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    rating: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    content: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    status: import("@medusajs/framework/utils").EnumProperty<["pending", "approved", "hidden", "deleted"]>;
    verified_buyer: import("@medusajs/framework/utils").BooleanProperty;
    edited_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    published_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    /**
     * La tienda donde se publicó el comentario. `NULL` = anterior a la columna.
     *
     * Un producto puede estar en varias tiendas, así que el comentario NO hereda su
     * canal del producto: se guarda el de la publishable key con la que se publicó,
     * que es el único dato que dice desde dónde escribió esa persona.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "comment">;
export default Comment;
