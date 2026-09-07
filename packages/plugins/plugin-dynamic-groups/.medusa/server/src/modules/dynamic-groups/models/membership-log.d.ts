/**
 * Historial/auditoría de pertenencia: cada vez que un cliente entra o sale de
 * un grupo dinámico se registra acá, con la razón (regla/atributos que lo
 * dispararon). Permite responder "¿por qué este cliente recibió/no recibió X?".
 */
export declare const DynamicGroupMembershipLog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    dynamic_group_id: import("@medusajs/framework/utils").TextProperty;
    customer_id: import("@medusajs/framework/utils").TextProperty;
    action: import("@medusajs/framework/utils").TextProperty;
    reason: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "dynamic_group_membership_log">;
export default DynamicGroupMembershipLog;
