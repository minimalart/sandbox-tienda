"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Comment = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Comment — generic, reusable comment/review attached to any commentable entity
 * (product, blog post) via a polymorphic (commentable_type, commentable_id)
 * pair, NOT a foreign key — same approach as blog-post-product.ts. Supports one
 * level of nesting through `parent_id` (replies). Depending on the global
 * `review_mode` (see CommentSettings) it may carry a `rating`, a `content`, or
 * both.
 */
exports.Comment = utils_1.model
    .define('comment', {
    id: utils_1.model.id({ prefix: 'cmt' }).primaryKey(),
    // Polymorphic target. No FK: the entity lives in another module.
    commentable_type: utils_1.model.enum(['product', 'blog_post']),
    commentable_id: utils_1.model.text(),
    // One level of nesting only. A reply points to a top-level comment; a comment
    // that already has a parent_id can't be replied to (enforced in the API).
    parent_id: utils_1.model.text().nullable(),
    customer_id: utils_1.model.text(),
    // Snapshot of the author's display name so the listing doesn't need to join
    // the customer module for every row.
    author_name: utils_1.model.text().nullable(),
    // 1..rating_scale; null when review_mode = 'comment'.
    rating: utils_1.model.number().nullable(),
    // null when review_mode = 'rating'.
    content: utils_1.model.text().nullable(),
    status: utils_1.model
        .enum(['pending', 'approved', 'hidden', 'deleted'])
        .default('pending'),
    // True when the author had a valid (paid+) order including the product.
    verified_buyer: utils_1.model.boolean().default(false),
    edited_at: utils_1.model.dateTime().nullable(),
    published_at: utils_1.model.dateTime().nullable(),
    /**
     * La tienda donde se publicó el comentario. `NULL` = anterior a la columna.
     *
     * Un producto puede estar en varias tiendas, así que el comentario NO hereda su
     * canal del producto: se guarda el de la publishable key con la que se publicó,
     * que es el único dato que dice desde dónde escribió esa persona.
     */
    site_id: utils_1.model.text().nullable(),
})
    .indexes([
    { on: ['commentable_type', 'commentable_id', 'status'] },
    { on: ['parent_id'] },
    { on: ['customer_id'] },
]);
exports.default = exports.Comment;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lbnRzL21vZGVscy9jb21tZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRDs7Ozs7OztHQU9HO0FBQ1UsUUFBQSxPQUFPLEdBQUcsYUFBSztLQUN6QixNQUFNLENBQUMsU0FBUyxFQUFFO0lBQ2pCLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzVDLGlFQUFpRTtJQUNqRSxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3RELGNBQWMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQzVCLDhFQUE4RTtJQUM5RSwwRUFBMEU7SUFDMUUsU0FBUyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDekIsNEVBQTRFO0lBQzVFLHFDQUFxQztJQUNyQyxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxzREFBc0Q7SUFDdEQsTUFBTSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsb0NBQW9DO0lBQ3BDLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hDLE1BQU0sRUFBRSxhQUFLO1NBQ1YsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDbEQsT0FBTyxDQUFDLFNBQVMsQ0FBQztJQUNyQix3RUFBd0U7SUFDeEUsY0FBYyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQzlDLFNBQVMsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLFlBQVksRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDOzs7Ozs7T0FNRztJQUNILE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2pDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixFQUFFLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxFQUFFO0lBQ3hELEVBQUUsRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUU7SUFDckIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRTtDQUN4QixDQUFDLENBQUM7QUFFTCxrQkFBZSxlQUFPLENBQUMifQ==