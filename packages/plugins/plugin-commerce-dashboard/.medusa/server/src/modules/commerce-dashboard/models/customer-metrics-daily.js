"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerMetricsDaily = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.CustomerMetricsDaily = utils_1.model
    .define('customer_metrics_daily', {
    id: utils_1.model.id({ prefix: 'cumd' }).primaryKey(),
    bucket: utils_1.model.text().default('daily'),
    period_start: utils_1.model.dateTime(),
    period_end: utils_1.model.dateTime(),
    sales_channel_id: utils_1.model.text().nullable(),
    country_code: utils_1.model.text().nullable(),
    currency_code: utils_1.model.text(),
    new_customers: utils_1.model.number().default(0),
    returning_customers: utils_1.model.number().default(0),
    customers_with_orders: utils_1.model.number().default(0),
    repeat_customers: utils_1.model.number().default(0),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VzdG9tZXItbWV0cmljcy1kYWlseS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lcmNlLWRhc2hib2FyZC9tb2RlbHMvY3VzdG9tZXItbWV0cmljcy1kYWlseS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSxvQkFBb0IsR0FBRyxhQUFLO0tBQ3RDLE1BQU0sQ0FBQyx3QkFBd0IsRUFBRTtJQUNoQyxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM3QyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDckMsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUU7SUFDOUIsVUFBVSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUU7SUFDNUIsZ0JBQWdCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN6QyxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNyQyxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMzQixhQUFhLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDeEMsbUJBQW1CLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDOUMscUJBQXFCLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDaEQsZ0JBQWdCLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDM0Msb0JBQW9CLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDL0MsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsYUFBYSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUU7Q0FDaEMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxFQUFFLGNBQWMsQ0FBQyxFQUFFO0lBQ2xDLEVBQUUsRUFBRSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsY0FBYyxDQUFDLEVBQUU7SUFDNUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLEVBQUU7SUFDeEMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxlQUFlLEVBQUUsY0FBYyxDQUFDLEVBQUU7Q0FDMUMsQ0FBQyxDQUFDIn0=