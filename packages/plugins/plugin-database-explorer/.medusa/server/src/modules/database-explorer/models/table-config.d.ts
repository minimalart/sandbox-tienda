export declare const DatabaseExplorerTableConfig: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
export default DatabaseExplorerTableConfig;
