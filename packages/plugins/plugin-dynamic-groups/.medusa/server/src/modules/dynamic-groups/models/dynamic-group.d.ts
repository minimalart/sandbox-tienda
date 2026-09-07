/**
 * Grupo dinámico: una "regla viva". Cada grupo administra un customer_group
 * NATIVO de Medusa (`customer_group_id`) — el módulo agrega/quita clientes de
 * ese grupo según las `conditions`. Lo que ya depende de customer groups
 * (banners, y a futuro promos/precios) reacciona solo.
 */
export declare const DynamicGroup: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
    /**
     * La tienda dueña del grupo. `NULL` = global de la instancia.
     *
     * Los logs de membresía cuelgan del grupo y heredan su tienda por la FK.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "dynamic_group">;
export default DynamicGroup;
