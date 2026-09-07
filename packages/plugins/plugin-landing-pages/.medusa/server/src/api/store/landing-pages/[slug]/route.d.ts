import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /store/landing-pages/:slug — public, returns a single PUBLISHED landing
 * page by slug. Optional `?locale=` filter. 404 when not found/published.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
