export type CommerceDashboardFilters = {
    from: string;
    to: string;
    sales_channel_id?: string | null;
    country_code?: string | null;
    currency_code?: string | null;
    bucket?: 'daily' | 'hourly';
};
type MetricSummary = {
    value: number;
    previous: number;
    delta: number;
};
declare const CommerceDashboardModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly CommerceMetricsDaily: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        bucket: import("@medusajs/framework/utils").TextProperty;
        period_start: import("@medusajs/framework/utils").DateTimeProperty;
        period_end: import("@medusajs/framework/utils").DateTimeProperty;
        sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        currency_code: import("@medusajs/framework/utils").TextProperty;
        revenue: import("@medusajs/framework/utils").NumberProperty;
        orders: import("@medusajs/framework/utils").NumberProperty;
        aov: import("@medusajs/framework/utils").NumberProperty;
        units_sold: import("@medusajs/framework/utils").NumberProperty;
        new_customers: import("@medusajs/framework/utils").NumberProperty;
        returning_customers: import("@medusajs/framework/utils").NumberProperty;
        refunds: import("@medusajs/framework/utils").NumberProperty;
        conversion_proxy: import("@medusajs/framework/utils").NumberProperty;
        repeat_purchase_rate: import("@medusajs/framework/utils").NumberProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        aggregated_at: import("@medusajs/framework/utils").DateTimeProperty;
    }>, "commerce_metrics_daily">;
    readonly ProductMetricsDaily: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        bucket: import("@medusajs/framework/utils").TextProperty;
        period_start: import("@medusajs/framework/utils").DateTimeProperty;
        period_end: import("@medusajs/framework/utils").DateTimeProperty;
        sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        currency_code: import("@medusajs/framework/utils").TextProperty;
        product_id: import("@medusajs/framework/utils").TextProperty;
        product_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_handle: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        collection_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        collection_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        category_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        category_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        revenue: import("@medusajs/framework/utils").NumberProperty;
        orders: import("@medusajs/framework/utils").NumberProperty;
        units_sold: import("@medusajs/framework/utils").NumberProperty;
        refunds: import("@medusajs/framework/utils").NumberProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        aggregated_at: import("@medusajs/framework/utils").DateTimeProperty;
    }>, "product_metrics_daily">;
    readonly CollectionMetricsDaily: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        bucket: import("@medusajs/framework/utils").TextProperty;
        period_start: import("@medusajs/framework/utils").DateTimeProperty;
        period_end: import("@medusajs/framework/utils").DateTimeProperty;
        sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        currency_code: import("@medusajs/framework/utils").TextProperty;
        collection_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        collection_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        category_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        category_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        revenue: import("@medusajs/framework/utils").NumberProperty;
        orders: import("@medusajs/framework/utils").NumberProperty;
        units_sold: import("@medusajs/framework/utils").NumberProperty;
        refunds: import("@medusajs/framework/utils").NumberProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        aggregated_at: import("@medusajs/framework/utils").DateTimeProperty;
    }>, "collection_metrics_daily">;
    readonly CustomerMetricsDaily: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
}>>;
declare class CommerceDashboardModuleService extends CommerceDashboardModuleService_base {
    private get knex();
    private normalizeFilters;
    private applyFilters;
    private summary;
    private commerceSummary;
    getLastAggregatedAt(filtersInput: CommerceDashboardFilters): Promise<string | null>;
    private chart;
    private withShares;
    private metricTotals;
    private topProducts;
    private topCollections;
    private topCategories;
    private customerSummary;
    private calendar;
    private breakdown;
    getDashboard(filtersInput: CommerceDashboardFilters): Promise<{
        filters: {
            bucket: "daily" | "hourly";
            from: Date;
            to: Date;
            previousFrom: Date;
            previousTo: Date;
            sales_channel_id: string | null;
            country_code: string | null;
            currency_code: string | null;
        };
        kpis: {
            revenue: MetricSummary;
            orders: MetricSummary;
            aov: MetricSummary;
            units_sold: MetricSummary;
            new_customers: MetricSummary;
            returning_customers: MetricSummary;
            refunds: MetricSummary;
            conversion_proxy: MetricSummary;
        };
        customers: {
            new_customers: MetricSummary;
            returning_customers: MetricSummary;
            customers_with_orders: MetricSummary;
            repeat_customers: MetricSummary;
            repeat_purchase_rate: MetricSummary;
            returning_share: MetricSummary;
        };
        charts: {
            revenue_over_time: any;
            orders_over_time: any;
            units_sold_over_time: any;
            aov_over_time: any;
            repeat_purchase_rate_over_time: any;
            commercial_calendar: {
                mode: string;
                rows: any;
            };
        };
        breakdowns: {
            sales_channels: any;
            countries: any;
            currencies: any;
        };
        tables: {
            top_products: any;
            top_collections: any;
            top_categories: any;
        };
        future_capabilities: {
            ai_insights: string;
            forecasting: string;
            campaign_attribution: string;
        };
    }>;
}
export default CommerceDashboardModuleService;
