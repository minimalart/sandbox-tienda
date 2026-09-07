"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Brand = void 0;
const utils_1 = require("@medusajs/framework/utils");
const product_brand_link_1 = require("./product-brand-link");
exports.Brand = utils_1.model.define('brand', {
    id: utils_1.model
        .id({
        prefix: 'brand',
    })
        .primaryKey(),
    name: utils_1.model.text(),
    handle: utils_1.model.text().unique(),
    description: utils_1.model.text().nullable(),
    is_active: utils_1.model.boolean().default(true),
    // Segmentación por sales channel: array de ids. null/[] = visible en todos
    // los canales (comportamiento global actual). En contexto demo el storefront
    // pide solo las marcas cuyo array incluye el canal de la demo.
    sales_channel_ids: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
    product_links: utils_1.model.hasMany(() => product_brand_link_1.ProductBrandLink, {
        mappedBy: 'brand',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJhbmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9icmFuZC9tb2RlbHMvYnJhbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBQ2xELDZEQUF3RDtBQUUzQyxRQUFBLEtBQUssR0FBRyxhQUFLLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtJQUN6QyxFQUFFLEVBQUUsYUFBSztTQUNOLEVBQUUsQ0FBQztRQUNGLE1BQU0sRUFBRSxPQUFPO0tBQ2hCLENBQUM7U0FDRCxVQUFVLEVBQUU7SUFDZixJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRTtJQUM3QixXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxTQUFTLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDeEMsMkVBQTJFO0lBQzNFLDZFQUE2RTtJQUM3RSwrREFBK0Q7SUFDL0QsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQyxhQUFhLEVBQUUsYUFBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxxQ0FBZ0IsRUFBRTtRQUNuRCxRQUFRLEVBQUUsT0FBTztLQUNsQixDQUFDO0NBQ0gsQ0FBQyxDQUFDIn0=