import { type DatabaseExplorerColumnDefinition, type DatabaseExplorerTableDefinition, type RowsQueryInput } from './access-control';
type AuditInput = {
    user_id?: string | null;
    action: string;
    table_name?: string | null;
    record_id?: string | null;
    view_id?: string | null;
    filters_json?: Record<string, unknown> | null;
    duration_ms?: number | null;
    success?: boolean;
    error_message?: string | null;
};
type RowsResult = {
    table: DatabaseExplorerTableDefinition;
    rows: Array<Record<string, unknown>>;
    count: number;
    limit: number;
    offset: number;
};
type Relation = {
    id: string;
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
    relation_type: string;
    display_name: string | null;
    inferred: boolean;
};
declare const DatabaseExplorerModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly DatabaseExplorerAuditLog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        user_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        action: import("@medusajs/framework/utils").TextProperty;
        table_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        record_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        view_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        filters_json: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        duration_ms: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        success: import("@medusajs/framework/utils").BooleanProperty;
        error_message: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "database_explorer_audit_log">;
    readonly DatabaseExplorerColumnConfig: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        table_name: import("@medusajs/framework/utils").TextProperty;
        column_name: import("@medusajs/framework/utils").TextProperty;
        display_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        data_type: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        visible: import("@medusajs/framework/utils").BooleanProperty;
        masked: import("@medusajs/framework/utils").BooleanProperty;
        searchable: import("@medusajs/framework/utils").BooleanProperty;
        filterable: import("@medusajs/framework/utils").BooleanProperty;
        sortable: import("@medusajs/framework/utils").BooleanProperty;
        sensitive: import("@medusajs/framework/utils").BooleanProperty;
    }>, "database_explorer_column_config">;
    readonly DatabaseExplorerRelationConfig: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        source_table: import("@medusajs/framework/utils").TextProperty;
        source_column: import("@medusajs/framework/utils").TextProperty;
        target_table: import("@medusajs/framework/utils").TextProperty;
        target_column: import("@medusajs/framework/utils").TextProperty;
        relation_type: import("@medusajs/framework/utils").TextProperty;
        display_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        enabled: import("@medusajs/framework/utils").BooleanProperty;
    }>, "database_explorer_relation_config">;
    readonly DatabaseExplorerSavedView: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        name: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        table_name: import("@medusajs/framework/utils").TextProperty;
        filters_json: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        columns_json: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        sort_json: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        role_ids_json: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        enabled: import("@medusajs/framework/utils").BooleanProperty;
    }>, "database_explorer_saved_view">;
    readonly DatabaseExplorerTableConfig: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        table_name: import("@medusajs/framework/utils").TextProperty;
        display_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        enabled: import("@medusajs/framework/utils").BooleanProperty;
        show_in_visual: import("@medusajs/framework/utils").BooleanProperty;
        primary_label_column: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        default_sort_column: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        default_sort_direction: import("@medusajs/framework/utils").TextProperty;
    }>, "database_explorer_table_config">;
}>>;
declare class DatabaseExplorerModuleService extends DatabaseExplorerModuleService_base {
    private get knex();
    private informationSchema;
    private rawInformationSchema;
    private defaultTable;
    private definitions;
    listTables(includeDisabled?: boolean): Promise<DatabaseExplorerTableDefinition[]>;
    listAllPublicTablesForSettings(): Promise<{
        table_name: string;
        configured: boolean;
        enabled: boolean;
        columns: {
            column_name: string;
            data_type: string;
        }[];
    }[]>;
    retrieveDefinition(tableName: string, includeDisabled?: boolean): Promise<DatabaseExplorerTableDefinition>;
    private applyQuery;
    getRows(tableName: string, input: RowsQueryInput, actorId?: string | null): Promise<RowsResult>;
    getRow(tableName: string, id: string, actorId?: string | null): Promise<{
        table: DatabaseExplorerTableDefinition;
        row: Record<string, unknown>;
    }>;
    listRelations(): Promise<Relation[]>;
    schemaGraph(): Promise<{
        nodes: {
            id: string;
            label: string;
            table_name: string;
            description: string | null;
            primary_label_column: string | null;
            fields: {
                column_name: string;
                data_type: string | null;
                masked: boolean;
            }[];
            has_sensitive_fields: boolean;
        }[];
        edges: Relation[];
    }>;
    listSavedViews(): Promise<({
        id: string;
        name: string;
        description: string;
        table_name: string;
        filters_json: {
            status?: undefined;
        };
        sort_json: {
            column: string;
            direction: string;
        };
    } | {
        id: string;
        name: string;
        description: string;
        table_name: string;
        filters_json: {
            status: string;
        };
        sort_json: {
            column: string;
            direction: string;
        };
    })[]>;
    runSavedView(viewId: string, input: RowsQueryInput, actorId?: string | null): Promise<{
        table: DatabaseExplorerTableDefinition;
        rows: Array<Record<string, unknown>>;
        count: number;
        limit: number;
        offset: number;
        view: {
            id: string;
            name: string;
            description: string;
            table_name: string;
            filters_json: {
                status?: undefined;
            };
            sort_json: {
                column: string;
                direction: string;
            };
        } | {
            id: string;
            name: string;
            description: string;
            table_name: string;
            filters_json: {
                status: string;
            };
            sort_json: {
                column: string;
                direction: string;
            };
        };
    }>;
    listAudit(opts?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        audit_logs: any;
        count: any;
        limit: number;
        offset: number;
    }>;
    upsertTableConfig(input: Partial<DatabaseExplorerTableDefinition> & {
        table_name: string;
    }): Promise<any>;
    upsertColumnConfig(tableName: string, input: DatabaseExplorerColumnDefinition): Promise<any>;
    audit(input: AuditInput): Promise<void>;
}
export default DatabaseExplorerModuleService;
