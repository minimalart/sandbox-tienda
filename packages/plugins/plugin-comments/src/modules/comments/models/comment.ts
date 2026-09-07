import { model } from '@medusajs/framework/utils';

/**
 * Comment — generic, reusable comment/review attached to any commentable entity
 * (product, blog post) via a polymorphic (commentable_type, commentable_id)
 * pair, NOT a foreign key — same approach as blog-post-product.ts. Supports one
 * level of nesting through `parent_id` (replies). Depending on the global
 * `review_mode` (see CommentSettings) it may carry a `rating`, a `content`, or
 * both.
 */
export const Comment = model
  .define('comment', {
    id: model.id({ prefix: 'cmt' }).primaryKey(),
    // Polymorphic target. No FK: the entity lives in another module.
    commentable_type: model.enum(['product', 'blog_post']),
    commentable_id: model.text(),
    // One level of nesting only. A reply points to a top-level comment; a comment
    // that already has a parent_id can't be replied to (enforced in the API).
    parent_id: model.text().nullable(),
    customer_id: model.text(),
    // Snapshot of the author's display name so the listing doesn't need to join
    // the customer module for every row.
    author_name: model.text().nullable(),
    // 1..rating_scale; null when review_mode = 'comment'.
    rating: model.number().nullable(),
    // null when review_mode = 'rating'.
    content: model.text().nullable(),
    status: model
      .enum(['pending', 'approved', 'hidden', 'deleted'])
      .default('pending'),
    // True when the author had a valid (paid+) order including the product.
    verified_buyer: model.boolean().default(false),
    edited_at: model.dateTime().nullable(),
    published_at: model.dateTime().nullable(),
    /**
     * La tienda donde se publicó el comentario. `NULL` = anterior a la columna.
     *
     * Un producto puede estar en varias tiendas, así que el comentario NO hereda su
     * canal del producto: se guarda el de la publishable key con la que se publicó,
     * que es el único dato que dice desde dónde escribió esa persona.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    { on: ['commentable_type', 'commentable_id', 'status'] },
    { on: ['parent_id'] },
    { on: ['customer_id'] },
  ]);

export default Comment;
