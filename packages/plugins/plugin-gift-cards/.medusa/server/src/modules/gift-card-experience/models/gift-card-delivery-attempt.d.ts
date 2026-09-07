export declare const GiftCardDeliveryAttempt: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    delivery_id: import("@medusajs/framework/utils").TextProperty;
    attempt_no: import("@medusajs/framework/utils").NumberProperty;
    channel: import("@medusajs/framework/utils").EnumProperty<["email", "audit"]>;
    trigger: import("@medusajs/framework/utils").EnumProperty<["initial", "automatic_retry", "manual_resend", "fallback_buyer", "secure_link"]>;
    status: import("@medusajs/framework/utils").EnumProperty<["processing", "sent", "delivered", "failed"]>;
    recipient: import("@medusajs/framework/utils").TextProperty;
    notification_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    provider_message_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    error: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    attempted_at: import("@medusajs/framework/utils").DateTimeProperty;
    completed_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "gift_card_delivery_attempt">;
