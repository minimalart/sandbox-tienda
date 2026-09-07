/**
 * Beneficio de pago curado. Puede ser MANUAL (editable) o SINCRONIZADO desde un
 * proveedor (read_only=true → los campos oficiales no se editan, solo
 * visibilidad/prioridad/notas/canales).
 *
 * Nunca toca el precio del producto: es informativo (PRD §14).
 * `eligibility` y `conditions` van como JSON para no explotar en tablas/joins.
 * `sales_channel_ids` scopea por demo (patrón banner/brand): vacío = todos.
 */
export declare const PaymentBenefit: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    provider_code: import("@medusajs/framework/utils").TextProperty;
    external_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    title: import("@medusajs/framework/utils").TextProperty;
    description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    benefit_type: import("@medusajs/framework/utils").TextProperty;
    discount_type: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    discount_value: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    max_installments: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    interest_rate: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    max_refund: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    minimum_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    maximum_amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
    source: import("@medusajs/framework/utils").TextProperty;
    read_only: import("@medusajs/framework/utils").BooleanProperty;
    status: import("@medusajs/framework/utils").TextProperty;
    priority: import("@medusajs/framework/utils").NumberProperty;
    valid_from: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    valid_to: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    eligibility: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    conditions: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    sales_channel_ids: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    admin_notes: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    hidden: import("@medusajs/framework/utils").BooleanProperty;
    last_synced_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "payment_benefit">;
export default PaymentBenefit;
