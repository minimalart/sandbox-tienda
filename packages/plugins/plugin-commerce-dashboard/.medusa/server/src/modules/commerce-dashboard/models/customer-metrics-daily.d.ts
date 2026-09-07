export declare const CustomerMetricsDaily: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    bucket: import("@medusajs/framework/utils").TextProperty;
    period_start: import("@medusajs/framework/utils").DateTimeProperty;
    period_end: import("@medusajs/framework/utils").DateTimeProperty;
    sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    currency_code: import("@medusajs/framework/utils").TextProperty;
    new_customers: import("@medusajs/framework/utils").NumberProperty;
    returning_customers: import("@medusajs/framework/utils").NumberProperty;
    customers_with_orders: import("@medusajs/framework/utils").NumberProperty;
    repeat_customers: import("@medusajs/framework/utils").NumberProperty;
    repeat_purchase_rate: import("@medusajs/framework/utils").NumberProperty;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    aggregated_at: import("@medusajs/framework/utils").DateTimeProperty;
}>, "customer_metrics_daily">;
