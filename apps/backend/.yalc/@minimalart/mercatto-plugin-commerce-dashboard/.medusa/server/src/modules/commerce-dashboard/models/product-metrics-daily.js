"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductMetricsDaily = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.ProductMetricsDaily = utils_1.model
    .define('product_metrics_daily', {
    id: utils_1.model.id({ prefix: 'pmd' }).primaryKey(),
    bucket: utils_1.model.text().default('daily'),
    period_start: utils_1.model.dateTime(),
    period_end: utils_1.model.dateTime(),
    sales_channel_id: utils_1.model.text().nullable(),
    country_code: utils_1.model.text().nullable(),
    currency_code: utils_1.model.text(),
    product_id: utils_1.model.text(),
    product_title: utils_1.model.text().nullable(),
    product_handle: utils_1.model.text().nullable(),
    collection_id: utils_1.model.text().nullable(),
    collection_title: utils_1.model.text().nullable(),
    category_id: utils_1.model.text().nullable(),
    category_name: utils_1.model.text().nullable(),
    revenue: utils_1.model.number().default(0),
    orders: utils_1.model.number().default(0),
    units_sold: utils_1.model.number().default(0),
    refunds: utils_1.model.number().default(0),
    metadata: utils_1.model.json().nullable(),
    aggregated_at: utils_1.model.dateTime(),
})
    .indexes([
    { on: ['bucket', 'period_start'] },
    { on: ['product_id', 'period_start'] },
    { on: ['sales_channel_id', 'period_start'] },
    { on: ['currency_code', 'period_start'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdC1tZXRyaWNzLWRhaWx5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvY29tbWVyY2UtZGFzaGJvYXJkL21vZGVscy9wcm9kdWN0LW1ldHJpY3MtZGFpbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRXJDLFFBQUEsbUJBQW1CLEdBQUcsYUFBSztLQUNyQyxNQUFNLENBQUMsdUJBQXVCLEVBQUU7SUFDL0IsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDNUMsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQ3JDLFlBQVksRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFO0lBQzlCLFVBQVUsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFO0lBQzVCLGdCQUFnQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDckMsYUFBYSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDM0IsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDeEIsYUFBYSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdEMsY0FBYyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdkMsYUFBYSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdEMsZ0JBQWdCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN6QyxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN0QyxPQUFPLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDbEMsTUFBTSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxPQUFPLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDbEMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsYUFBYSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUU7Q0FDaEMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxFQUFFLGNBQWMsQ0FBQyxFQUFFO0lBQ2xDLEVBQUUsRUFBRSxFQUFFLENBQUMsWUFBWSxFQUFFLGNBQWMsQ0FBQyxFQUFFO0lBQ3RDLEVBQUUsRUFBRSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsY0FBYyxDQUFDLEVBQUU7SUFDNUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxlQUFlLEVBQUUsY0FBYyxDQUFDLEVBQUU7Q0FDMUMsQ0FBQyxDQUFDIn0=