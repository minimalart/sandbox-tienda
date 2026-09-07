declare const DynamicGroupsModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly DynamicGroup: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        name: import("@medusajs/framework/utils").TextProperty;
        handle: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        customer_group_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        match: import("@medusajs/framework/utils").TextProperty;
        conditions: import("@medusajs/framework/utils").JSONProperty;
        update_mode: import("@medusajs/framework/utils").TextProperty;
        is_active: import("@medusajs/framework/utils").BooleanProperty;
        last_run_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        last_run_stats: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "dynamic_group">;
    readonly DynamicGroupMembershipLog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        dynamic_group_id: import("@medusajs/framework/utils").TextProperty;
        customer_id: import("@medusajs/framework/utils").TextProperty;
        action: import("@medusajs/framework/utils").TextProperty;
        reason: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "dynamic_group_membership_log">;
}>>;
declare class DynamicGroupsModuleService extends DynamicGroupsModuleService_base {
    /** Registra una entrada/salida de un cliente en el historial. */
    logMembership(entries: Array<{
        dynamic_group_id: string;
        customer_id: string;
        action: 'added' | 'removed';
        reason?: Record<string, unknown> | null;
    }>): Promise<void>;
}
export default DynamicGroupsModuleService;
