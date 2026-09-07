export declare const DatabaseExplorerRelationConfig: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    source_table: import("@medusajs/framework/utils").TextProperty;
    source_column: import("@medusajs/framework/utils").TextProperty;
    target_table: import("@medusajs/framework/utils").TextProperty;
    target_column: import("@medusajs/framework/utils").TextProperty;
    relation_type: import("@medusajs/framework/utils").TextProperty;
    display_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    enabled: import("@medusajs/framework/utils").BooleanProperty;
}>, "database_explorer_relation_config">;
export default DatabaseExplorerRelationConfig;
