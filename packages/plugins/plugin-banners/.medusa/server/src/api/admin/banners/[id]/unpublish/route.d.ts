import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/banners/:id/unpublish — set status back to 'draft' (via workflow)
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
