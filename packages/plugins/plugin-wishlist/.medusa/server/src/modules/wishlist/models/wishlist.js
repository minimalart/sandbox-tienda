"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wishlist = void 0;
const utils_1 = require("@medusajs/framework/utils");
const wishlist_item_1 = require("./wishlist-item");
// One wishlist per customer. customer_id is the customer module's id, kept as a
// scalar (no module link) — a favorite is simply "this customer marked these
// products". Product data is enriched on read via the product module.
exports.Wishlist = utils_1.model.define('wishlist', {
    id: utils_1.model
        .id({
        prefix: 'wish',
    })
        .primaryKey(),
    customer_id: utils_1.model.text().unique(),
    items: utils_1.model.hasMany(() => wishlist_item_1.WishlistItem, {
        mappedBy: 'wishlist',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2lzaGxpc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy93aXNobGlzdC9tb2RlbHMvd2lzaGxpc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBQ2xELG1EQUErQztBQUUvQyxnRkFBZ0Y7QUFDaEYsNkVBQTZFO0FBQzdFLHNFQUFzRTtBQUN6RCxRQUFBLFFBQVEsR0FBRyxhQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRTtJQUMvQyxFQUFFLEVBQUUsYUFBSztTQUNOLEVBQUUsQ0FBQztRQUNGLE1BQU0sRUFBRSxNQUFNO0tBQ2YsQ0FBQztTQUNELFVBQVUsRUFBRTtJQUNmLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFO0lBQ2xDLEtBQUssRUFBRSxhQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLDRCQUFZLEVBQUU7UUFDdkMsUUFBUSxFQUFFLFVBQVU7S0FDckIsQ0FBQztDQUNILENBQUMsQ0FBQyJ9