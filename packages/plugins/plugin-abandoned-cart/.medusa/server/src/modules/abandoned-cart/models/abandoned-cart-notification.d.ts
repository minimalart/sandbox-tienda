/**
 * Una fila por intento de envío (paso + canal). Da idempotencia (constraint único
 * `abandoned_cart_id + step + channel`, ver migración) y trazabilidad de la
 * secuencia: qué se envió, cuándo y con qué resultado.
 */
export declare const AbandonedCartNotification: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    abandoned_cart_id: import("@medusajs/framework/utils").TextProperty;
    step: import("@medusajs/framework/utils").NumberProperty;
    channel: import("@medusajs/framework/utils").TextProperty;
    template: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    recipient: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    status: import("@medusajs/framework/utils").TextProperty;
    error: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    sent_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
}>, "abandoned_cart_notification">;
export default AbandonedCartNotification;
