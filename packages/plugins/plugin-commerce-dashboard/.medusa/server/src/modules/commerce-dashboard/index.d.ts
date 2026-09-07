import CommerceDashboardModuleService from './service';
export declare const COMMERCE_DASHBOARD_MODULE = "commerce_dashboard";
declare const _default: import("@medusajs/types").ModuleExports<typeof CommerceDashboardModuleService> & {
    linkable: {
        readonly commerceMetricsDaily: {
            id: {
                serviceName: "commerce_dashboard";
                field: "commerceMetricsDaily";
                linkable: "commerce_metrics_daily_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "commerce_dashboard";
                field: "commerceMetricsDaily";
                linkable: "commerce_metrics_daily_id";
                primaryKey: "id";
            };
        };
        readonly productMetricsDaily: {
            id: {
                serviceName: "commerce_dashboard";
                field: "productMetricsDaily";
                linkable: "product_metrics_daily_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "commerce_dashboard";
                field: "productMetricsDaily";
                linkable: "product_metrics_daily_id";
                primaryKey: "id";
            };
        };
        readonly collectionMetricsDaily: {
            id: {
                serviceName: "commerce_dashboard";
                field: "collectionMetricsDaily";
                linkable: "collection_metrics_daily_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "commerce_dashboard";
                field: "collectionMetricsDaily";
                linkable: "collection_metrics_daily_id";
                primaryKey: "id";
            };
        };
        readonly customerMetricsDaily: {
            id: {
                serviceName: "commerce_dashboard";
                field: "customerMetricsDaily";
                linkable: "customer_metrics_daily_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "commerce_dashboard";
                field: "customerMetricsDaily";
                linkable: "customer_metrics_daily_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
