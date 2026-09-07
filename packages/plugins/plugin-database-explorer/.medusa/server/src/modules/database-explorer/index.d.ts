import DatabaseExplorerModuleService from './service';
export declare const DATABASE_EXPLORER_MODULE = "database_explorer";
declare const _default: import("@medusajs/types").ModuleExports<typeof DatabaseExplorerModuleService> & {
    linkable: {
        readonly databaseExplorerAuditLog: {
            id: {
                serviceName: "database_explorer";
                field: "databaseExplorerAuditLog";
                linkable: "database_explorer_audit_log_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "database_explorer";
                field: "databaseExplorerAuditLog";
                linkable: "database_explorer_audit_log_id";
                primaryKey: "id";
            };
        };
        readonly databaseExplorerColumnConfig: {
            id: {
                serviceName: "database_explorer";
                field: "databaseExplorerColumnConfig";
                linkable: "database_explorer_column_config_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "database_explorer";
                field: "databaseExplorerColumnConfig";
                linkable: "database_explorer_column_config_id";
                primaryKey: "id";
            };
        };
        readonly databaseExplorerRelationConfig: {
            id: {
                serviceName: "database_explorer";
                field: "databaseExplorerRelationConfig";
                linkable: "database_explorer_relation_config_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "database_explorer";
                field: "databaseExplorerRelationConfig";
                linkable: "database_explorer_relation_config_id";
                primaryKey: "id";
            };
        };
        readonly databaseExplorerSavedView: {
            id: {
                serviceName: "database_explorer";
                field: "databaseExplorerSavedView";
                linkable: "database_explorer_saved_view_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "database_explorer";
                field: "databaseExplorerSavedView";
                linkable: "database_explorer_saved_view_id";
                primaryKey: "id";
            };
        };
        readonly databaseExplorerTableConfig: {
            id: {
                serviceName: "database_explorer";
                field: "databaseExplorerTableConfig";
                linkable: "database_explorer_table_config_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "database_explorer";
                field: "databaseExplorerTableConfig";
                linkable: "database_explorer_table_config_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
