import CatalogadorModuleService from './service';
export declare const CATALOGADOR_MODULE = "catalogador";
declare const _default: import("@medusajs/types").ModuleExports<typeof CatalogadorModuleService> & {
    linkable: {
        readonly catalogingExecution: {
            id: {
                serviceName: "catalogador";
                field: "catalogingExecution";
                linkable: "cataloging_execution_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "catalogador";
                field: "catalogingExecution";
                linkable: "cataloging_execution_id";
                primaryKey: "id";
            };
        };
        readonly catalogingExecutionProduct: {
            id: {
                serviceName: "catalogador";
                field: "catalogingExecutionProduct";
                linkable: "cataloging_execution_product_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "catalogador";
                field: "catalogingExecutionProduct";
                linkable: "cataloging_execution_product_id";
                primaryKey: "id";
            };
        };
        readonly catalogingOperation: {
            id: {
                serviceName: "catalogador";
                field: "catalogingOperation";
                linkable: "cataloging_operation_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "catalogador";
                field: "catalogingOperation";
                linkable: "cataloging_operation_id";
                primaryKey: "id";
            };
        };
        readonly catalogingAssetProposal: {
            id: {
                serviceName: "catalogador";
                field: "catalogingAssetProposal";
                linkable: "cataloging_asset_proposal_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "catalogador";
                field: "catalogingAssetProposal";
                linkable: "cataloging_asset_proposal_id";
                primaryKey: "id";
            };
        };
        readonly catalogingSnapshot: {
            id: {
                serviceName: "catalogador";
                field: "catalogingSnapshot";
                linkable: "cataloging_snapshot_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "catalogador";
                field: "catalogingSnapshot";
                linkable: "cataloging_snapshot_id";
                primaryKey: "id";
            };
        };
        readonly catalogingActivity: {
            id: {
                serviceName: "catalogador";
                field: "catalogingActivity";
                linkable: "cataloging_activity_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "catalogador";
                field: "catalogingActivity";
                linkable: "cataloging_activity_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
