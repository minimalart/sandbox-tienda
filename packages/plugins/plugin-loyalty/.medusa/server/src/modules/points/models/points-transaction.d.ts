export declare const PointsTransaction: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    amount: import("@medusajs/framework/utils").NumberProperty;
    type: import("@medusajs/framework/utils").EnumProperty<["earn", "redeem", "adjust", "reverse", "expire"]>;
    status: import("@medusajs/framework/utils").EnumProperty<["pending", "available", "expired", "reversed"]>;
    reference: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    reference_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    idempotency_key: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    expires_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    program_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    earn_rule_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    campaign_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    account: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        customer_id: import("@medusajs/framework/utils").TextProperty;
        balance: import("@medusajs/framework/utils").NumberProperty;
        transactions: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "points_transaction">>;
    }>, "points_account">, undefined>;
}>, "points_transaction">;
