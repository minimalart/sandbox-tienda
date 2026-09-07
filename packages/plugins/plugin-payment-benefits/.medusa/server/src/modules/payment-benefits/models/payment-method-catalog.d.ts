/**
 * Catálogo CRUDO de medios de pago sincronizado desde un proveedor (MP:
 * GET /v1/payment_methods + snapshot de cuotas sin interés vía
 * GET /v1/payment_methods/installments). Separado de `payment_benefit` para
 * distinguir el dato oficial del proveedor de los beneficios curados.
 *
 * Único por (provider_code, external_id) — se upsertea en cada sync.
 */
export declare const PaymentMethodCatalog: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    provider_code: import("@medusajs/framework/utils").TextProperty;
    external_id: import("@medusajs/framework/utils").TextProperty;
    name: import("@medusajs/framework/utils").TextProperty;
    payment_type_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    status: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    thumbnail_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    min_allowed_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    max_allowed_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    max_interest_free_installments: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    raw: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    last_synced_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    /**
     * La tienda cuya cuenta del proveedor produjo este catálogo. `NULL` = GLOBAL, el
     * sincronizado con las credenciales de entorno.
     *
     * Importa desde que las credenciales de MercadoPago son por tienda: dos tiendas con
     * cuentas distintas pueden tener medios de pago distintos habilitados, y mostrar el
     * catálogo de una en la otra le ofrece al comprador un medio que su checkout va a
     * rechazar.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "payment_method_catalog">;
export default PaymentMethodCatalog;
