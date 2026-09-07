import { type ResolvedCheckoutLink } from './types';
declare const CheckoutLinkModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly CheckoutLink: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        token: import("@medusajs/framework/utils").TextProperty;
        internal_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        items: import("@medusajs/framework/utils").JSONProperty;
        country_code: import("@medusajs/framework/utils").TextProperty;
        region_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        email: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        shipping_address: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        promo_codes: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        status: import("@medusajs/framework/utils").TextProperty;
        single_use: import("@medusajs/framework/utils").BooleanProperty;
        used_count: import("@medusajs/framework/utils").NumberProperty;
        expires_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        created_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "checkout_link">;
}>>;
declare class CheckoutLinkModuleService extends CheckoutLinkModuleService_base {
    /**
     * URL-safe opaque token. ~11 chars from 8 random bytes (base64url, no
     * padding). Collisions are vanishingly unlikely; the workflow retries on the
     * unique constraint just in case.
     */
    generateToken(): string;
    private isExpired;
    /**
     * Resolves a token to the public payload needed to build the cart, or null
     * when the link is missing, disabled, expired, or a consumed single-use link.
     */
    resolveByToken(token: string): Promise<ResolvedCheckoutLink | null>;
    /**
     * Marks a link as consumed after an order is placed. Increments the counter
     * and, for single-use links, flips the status to `used`.
     */
    markUsed(token: string): Promise<void>;
}
export default CheckoutLinkModuleService;
