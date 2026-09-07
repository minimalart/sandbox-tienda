import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/banners/:id/publish — set status to 'published' (via workflow)
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
