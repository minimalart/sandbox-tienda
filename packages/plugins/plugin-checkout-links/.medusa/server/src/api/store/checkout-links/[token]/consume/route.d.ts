import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /store/checkout-links/:token/consume
 *
 * Marks a link as consumed once its order has been placed. Increments the usage
 * counter and, for single-use links, flips the status to `used` so the link can
 * no longer be resolved. Always returns 200 (best-effort, non-blocking for the
 * storefront's order-completion flow).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
