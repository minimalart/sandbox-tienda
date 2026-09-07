"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfCatalogHotspot = void 0;
const utils_1 = require("@medusajs/framework/utils");
const pdf_catalog_1 = require("./pdf-catalog");
/**
 * PdfCatalogHotspot — un punto interactivo posicionado sobre una página del PDF.
 *
 * `type` decide qué payload aplica:
 * - product → usa `product_id` (+ `variant_id` opcional); precio/stock se
 *   resuelven en vivo por la store API (no se snapshotea, como shop_by_look).
 * - video   → `data = { youtubeUrl, title? }`.
 * - text    → `data = { title, content }`.
 *
 * `page_index` es 0-based. `pos_x` / `pos_y` son porcentajes enteros (0–100)
 * relativos al ancho/alto de la página renderizada.
 */
exports.PdfCatalogHotspot = utils_1.model
    .define('pdf_catalog_hotspot', {
    id: utils_1.model
        .id({
        prefix: 'pchs',
    })
        .primaryKey(),
    type: utils_1.model.enum(['product', 'video', 'text']).default('product'),
    page_index: utils_1.model.number().default(0),
    pos_x: utils_1.model.number().default(50),
    pos_y: utils_1.model.number().default(50),
    product_id: utils_1.model.text().nullable(),
    variant_id: utils_1.model.text().nullable(),
    data: utils_1.model.json().nullable(),
    sort_order: utils_1.model.number().default(0),
    catalog: utils_1.model.belongsTo(() => pdf_catalog_1.PdfCatalog, {
        mappedBy: 'hotspots',
    }),
})
    .indexes([
    {
        on: ['catalog_id'],
        where: 'deleted_at IS NULL',
    },
    {
        on: ['product_id'],
        where: 'deleted_at IS NULL',
    },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGRmLWNhdGFsb2ctaG90c3BvdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BkZi1jYXRhbG9nL21vZGVscy9wZGYtY2F0YWxvZy1ob3RzcG90LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCwrQ0FBMkM7QUFFM0M7Ozs7Ozs7Ozs7O0dBV0c7QUFDVSxRQUFBLGlCQUFpQixHQUFHLGFBQUs7S0FDbkMsTUFBTSxDQUFDLHFCQUFxQixFQUFFO0lBQzdCLEVBQUUsRUFBRSxhQUFLO1NBQ04sRUFBRSxDQUFDO1FBQ0YsTUFBTSxFQUFFLE1BQU07S0FDZixDQUFDO1NBQ0QsVUFBVSxFQUFFO0lBQ2YsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztJQUNqRSxVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckMsS0FBSyxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQ2pDLEtBQUssRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUNqQyxVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuQyxVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuQyxJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM3QixVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckMsT0FBTyxFQUFFLGFBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsd0JBQVUsRUFBRTtRQUN6QyxRQUFRLEVBQUUsVUFBVTtLQUNyQixDQUFDO0NBQ0gsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQO1FBQ0UsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDO1FBQ2xCLEtBQUssRUFBRSxvQkFBb0I7S0FDNUI7SUFDRDtRQUNFLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQztRQUNsQixLQUFLLEVBQUUsb0JBQW9CO0tBQzVCO0NBQ0YsQ0FBQyxDQUFDIn0=