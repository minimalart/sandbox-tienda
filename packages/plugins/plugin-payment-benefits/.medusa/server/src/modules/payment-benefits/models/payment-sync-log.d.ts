/**
 * Historial de sincronizaciones por proveedor. Alimenta el dashboard del
 * backoffice ("última sincronización", "errores de sincronización").
 */
export declare const PaymentSyncLog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    provider_code: import("@medusajs/framework/utils").TextProperty;
    status: import("@medusajs/framework/utils").TextProperty;
    items_synced: import("@medusajs/framework/utils").NumberProperty;
    message: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    started_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    finished_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
}>, "payment_sync_log">;
export default PaymentSyncLog;
