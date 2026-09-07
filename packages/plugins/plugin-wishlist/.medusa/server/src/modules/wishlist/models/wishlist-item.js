"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WishlistItem = void 0;
const utils_1 = require("@medusajs/framework/utils");
const wishlist_1 = require("./wishlist");
// A single favorited variant within a customer's wishlist. Tracked at the
// variant level (product_variant_id) to match the storefront contract, with
// product_id kept for convenience. Unique per (wishlist, product, variant).
exports.WishlistItem = utils_1.model
    .define('wishlist_item', {
    id: utils_1.model
        .id({
        prefix: 'wishitem',
    })
        .primaryKey(),
    product_id: utils_1.model.text(),
    product_variant_id: utils_1.model.text(),
    quantity: utils_1.model.number().default(1),
    wishlist: utils_1.model.belongsTo(() => wishlist_1.Wishlist, {
        mappedBy: 'items',
    }),
})
    .indexes([
    {
        on: ['wishlist_id', 'product_id', 'product_variant_id'],
        unique: true,
    },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2lzaGxpc3QtaXRlbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L21vZGVscy93aXNobGlzdC1pdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCx5Q0FBc0M7QUFFdEMsMEVBQTBFO0FBQzFFLDRFQUE0RTtBQUM1RSw0RUFBNEU7QUFDL0QsUUFBQSxZQUFZLEdBQUcsYUFBSztLQUM5QixNQUFNLENBQUMsZUFBZSxFQUFFO0lBQ3ZCLEVBQUUsRUFBRSxhQUFLO1NBQ04sRUFBRSxDQUFDO1FBQ0YsTUFBTSxFQUFFLFVBQVU7S0FDbkIsQ0FBQztTQUNELFVBQVUsRUFBRTtJQUNmLFVBQVUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3hCLGtCQUFrQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDaEMsUUFBUSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ25DLFFBQVEsRUFBRSxhQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLG1CQUFRLEVBQUU7UUFDeEMsUUFBUSxFQUFFLE9BQU87S0FDbEIsQ0FBQztDQUNILENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUDtRQUNFLEVBQUUsRUFBRSxDQUFDLGFBQWEsRUFBRSxZQUFZLEVBQUUsb0JBQW9CLENBQUM7UUFDdkQsTUFBTSxFQUFFLElBQUk7S0FDYjtDQUNGLENBQUMsQ0FBQyJ9