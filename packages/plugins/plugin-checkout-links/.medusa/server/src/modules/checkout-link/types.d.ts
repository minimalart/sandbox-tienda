export declare enum CheckoutLinkStatus {
    ACTIVE = "active",
    USED = "used",
    DISABLED = "disabled"
}
export interface CheckoutLinkItem {
    variant_id: string;
    quantity: number;
}
export interface CheckoutLinkAddress {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    company?: string;
    postal_code?: string;
    city?: string;
    country_code?: string;
    province?: string;
    phone?: string;
}
export interface CreateCheckoutLinkInput {
    internal_name?: string | null;
    items: CheckoutLinkItem[];
    country_code: string;
    region_id?: string | null;
    sales_channel_id?: string | null;
    email?: string | null;
    customer_id?: string | null;
    shipping_address?: CheckoutLinkAddress | null;
    promo_codes?: string[] | null;
    single_use?: boolean;
    expires_at?: Date | string | null;
    created_by?: string | null;
    metadata?: Record<string, unknown> | null;
}
export interface UpdateCheckoutLinkInput {
    internal_name?: string | null;
    items?: CheckoutLinkItem[];
    country_code?: string;
    region_id?: string | null;
    sales_channel_id?: string | null;
    email?: string | null;
    customer_id?: string | null;
    shipping_address?: CheckoutLinkAddress | null;
    promo_codes?: string[] | null;
    status?: string;
    single_use?: boolean;
    expires_at?: Date | string | null;
    metadata?: Record<string, unknown> | null;
}
/**
 * Public payload returned to the storefront when resolving a token. Only the
 * fields needed to build the cart — never `created_by` or internal metadata.
 */
export interface ResolvedCheckoutLink {
    items: CheckoutLinkItem[];
    country_code: string;
    region_id: string | null;
    sales_channel_id: string | null;
    email: string | null;
    shipping_address: CheckoutLinkAddress | null;
    promo_codes: string[];
}
