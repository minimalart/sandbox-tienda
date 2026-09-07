"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogPostProduct = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * BlogPostProduct — ordered association between a blog post and a catalog
 * product. `product_id` is a plain text column (no FK to the product table),
 * mirroring the vimeo-video `product_video_link` approach; products are
 * hydrated from the store products endpoint by id. `sort_order` preserves the
 * admin's drag & drop ordering.
 */
exports.BlogPostProduct = utils_1.model
    .define('blog_post_product', {
    id: utils_1.model.id({ prefix: 'bpp' }).primaryKey(),
    blog_post_id: utils_1.model.text(),
    product_id: utils_1.model.text(),
    sort_order: utils_1.model.number().default(0),
})
    .indexes([
    { on: ['blog_post_id'] },
    {
        on: ['blog_post_id', 'product_id'],
        unique: true,
        where: 'deleted_at IS NULL',
    },
]);
exports.default = exports.BlogPostProduct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmxvZy1wb3N0LXByb2R1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9ibG9nL21vZGVscy9ibG9nLXBvc3QtcHJvZHVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFbEQ7Ozs7OztHQU1HO0FBQ1UsUUFBQSxlQUFlLEdBQUcsYUFBSztLQUNqQyxNQUFNLENBQUMsbUJBQW1CLEVBQUU7SUFDM0IsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDNUMsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDMUIsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDeEIsVUFBVSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0NBQ3RDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFO0lBQ3hCO1FBQ0UsRUFBRSxFQUFFLENBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQztRQUNsQyxNQUFNLEVBQUUsSUFBSTtRQUNaLEtBQUssRUFBRSxvQkFBb0I7S0FDNUI7Q0FDRixDQUFDLENBQUM7QUFFTCxrQkFBZSx1QkFBZSxDQUFDIn0=