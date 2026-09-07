import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /store/landing-pages — public list of PUBLISHED landing pages.
 * Query: limit, offset, locale. Never returns drafts/archived.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
