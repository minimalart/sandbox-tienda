"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutLink = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * A preloaded checkout link. The operator authors one of these from the admin
 * (products, optional customer data, promos, expiry) and shares the resulting
 * public URL `/{country}/c/{token}`. The token is opaque; PII (email/address)
 * lives here in the DB, never in the URL.
 */
exports.CheckoutLink = utils_1.model
    .define('checkout_link', {
    id: utils_1.model.id({ prefix: 'chkl' }).primaryKey(),
    token: utils_1.model.text().unique(),
    internal_name: utils_1.model.text().nullable(),
    items: utils_1.model.json(),
    country_code: utils_1.model.text(),
    region_id: utils_1.model.text().nullable(),
    sales_channel_id: utils_1.model.text().nullable(),
    email: utils_1.model.text().nullable(),
    customer_id: utils_1.model.text().nullable(),
    shipping_address: utils_1.model.json().nullable(),
    promo_codes: utils_1.model.json().nullable(),
    status: utils_1.model.text().default('active'),
    single_use: utils_1.model.boolean().default(false),
    used_count: utils_1.model.number().default(0),
    expires_at: utils_1.model.dateTime().nullable(),
    created_by: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([{ on: ['token'] }, { on: ['status'] }]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tvdXQtbGluay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NoZWNrb3V0LWxpbmsvbW9kZWxzL2NoZWNrb3V0LWxpbmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7OztHQUtHO0FBQ1UsUUFBQSxZQUFZLEdBQUcsYUFBSztLQUM5QixNQUFNLENBQUMsZUFBZSxFQUFFO0lBQ3ZCLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzdDLEtBQUssRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFO0lBQzVCLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLEtBQUssRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ25CLFlBQVksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQzFCLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLGdCQUFnQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsS0FBSyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDOUIsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsZ0JBQWdCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN6QyxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFDdEMsVUFBVSxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQzFDLFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxVQUFVLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN2QyxVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuQyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNsQyxDQUFDO0tBQ0QsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMifQ==