export declare const GiftCardEvent: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    delivery_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    event: import("@medusajs/framework/utils").EnumProperty<["view", "purchase", "issued", "sent", "delivered", "claimed", "first_use", "exhausted", "balance_reminder", "expiring_notice"]>;
    design_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    currency_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").BigNumberProperty>;
    occurred_at: import("@medusajs/framework/utils").DateTimeProperty;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "gift_card_event">;
