import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /admin/banners — list all banners (no filters, admin sees everything)
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * POST /admin/banners — create a banner (validated, via workflow with audit trail)
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
