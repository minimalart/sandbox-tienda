"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommerceMetricsDaily = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.CommerceMetricsDaily = utils_1.model
    .define('commerce_metrics_daily', {
    id: utils_1.model.id({ prefix: 'cmd' }).primaryKey(),
    bucket: utils_1.model.text().default('daily'),
    period_start: utils_1.model.dateTime(),
    period_end: utils_1.model.dateTime(),
    sales_channel_id: utils_1.model.text().nullable(),
    country_code: utils_1.model.text().nullable(),
    currency_code: utils_1.model.text(),
    revenue: utils_1.model.number().default(0),
    orders: utils_1.model.number().default(0),
    aov: utils_1.model.number().default(0),
    units_sold: utils_1.model.number().default(0),
    new_customers: utils_1.model.number().default(0),
    returning_customers: utils_1.model.number().default(0),
    refunds: utils_1.model.number().default(0),
    conversion_proxy: utils_1.model.number().default(0),
    repeat_purchase_rate: utils_1.model.number().default(0),
    metadata: utils_1.model.json().nullable(),
    aggregated_at: utils_1.model.dateTime(),
})
    .indexes([
    { on: ['bucket', 'period_start'] },
    { on: ['sales_channel_id', 'period_start'] },
    { on: ['country_code', 'period_start'] },
    { on: ['currency_code', 'period_start'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVyY2UtbWV0cmljcy1kYWlseS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lcmNlLWRhc2hib2FyZC9tb2RlbHMvY29tbWVyY2UtbWV0cmljcy1kYWlseS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSxvQkFBb0IsR0FBRyxhQUFLO0tBQ3RDLE1BQU0sQ0FBQyx3QkFBd0IsRUFBRTtJQUNoQyxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM1QyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDckMsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUU7SUFDOUIsVUFBVSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUU7SUFDNUIsZ0JBQWdCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN6QyxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNyQyxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMzQixPQUFPLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDbEMsTUFBTSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLEdBQUcsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUM5QixVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckMsYUFBYSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3hDLG1CQUFtQixFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNsQyxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMzQyxvQkFBb0IsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMvQyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQyxhQUFhLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRTtDQUNoQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1AsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUUsY0FBYyxDQUFDLEVBQUU7SUFDbEMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxjQUFjLENBQUMsRUFBRTtJQUM1QyxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxjQUFjLENBQUMsRUFBRTtJQUN4QyxFQUFFLEVBQUUsRUFBRSxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsRUFBRTtDQUMxQyxDQUFDLENBQUMifQ==