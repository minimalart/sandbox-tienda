export declare const DatabaseExplorerColumnConfig: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
export default DatabaseExplorerColumnConfig;
