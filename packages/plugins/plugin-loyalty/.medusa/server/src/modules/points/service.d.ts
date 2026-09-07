type LedgerRef = {
    reference?: string | null;
    reference_id?: string | null;
    idempotency_key?: string | null;
    program_id?: string | null;
    earn_rule_id?: string | null;
    campaign_id?: string | null;
    expires_at?: Date | null;
    status?: 'pending' | 'available';
};
declare const PointsModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly PointsAccount: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        customer_id: import("@medusajs/framework/utils").TextProperty;
        balance: import("@medusajs/framework/utils").NumberProperty;
        transactions: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
            account: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "points_account">, undefined>;
        }>, "points_transaction">>;
    }>, "points_account">;
    readonly PointsTransaction: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
}>>;
declare class PointsModuleService extends PointsModuleService_base {
    getOrCreateAccount(customerId: string): Promise<{
        id: string;
        balance: number;
    }>;
    getAvailableBalance(customerId: string): Promise<number>;
    private computeBalanceForAccount;
    private syncBalance;
    private findByIdempotencyKey;
    private appendEntry;
    earnPoints(customerId: string, amount: number, ref?: LedgerRef): Promise<{
        id: string;
        balance: number;
    } | null>;
    redeemPoints(customerId: string, amount: number, ref?: LedgerRef): Promise<{
        id: string;
        balance: number;
    }>;
    reversePoints(customerId: string, amount: number, ref?: LedgerRef): Promise<{
        id: string;
        balance: number;
    } | null>;
    expirePoints(customerId: string, amount: number, ref?: LedgerRef): Promise<{
        id: string;
        balance: number;
    } | null>;
    adjustPoints(customerId: string, amount: number, ref?: LedgerRef): Promise<{
        id: string;
        balance: number;
    } | null>;
    expireDueLots(now?: Date): Promise<{
        expired: number;
    }>;
}
export default PointsModuleService;
