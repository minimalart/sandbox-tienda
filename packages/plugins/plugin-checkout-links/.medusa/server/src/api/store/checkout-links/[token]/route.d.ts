import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /store/checkout-links/:token
 *
 * Public resolver for a preloaded checkout link. Returns only the data needed
 * to build the cart (never `created_by`/internal metadata). Responds 404 when
 * the link is missing, disabled, expired, or a consumed single-use link.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
