import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/banners/:id/archive — set status to 'archived' (via workflow)
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
