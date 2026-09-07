import type { MedusaContainer } from '@medusajs/framework/types';
/** Display name snapshot for a customer ("First Last" / email fallback). */
export declare function getCustomerName(container: MedusaContainer, customerId: string): Promise<string | null>;
/**
 * Returns true when the customer has received (delivered) the given product:
 * an order containing the product where the matching line item belongs to a
 * fulfillment that has been marked delivered (`delivered_at` set). This is the
 * "pedido entregado" gate for writing reviews — stricter than just "paid".
 */
export declare function hasDeliveredPurchase(container: MedusaContainer, customerId: string, productId: string): Promise<boolean>;
