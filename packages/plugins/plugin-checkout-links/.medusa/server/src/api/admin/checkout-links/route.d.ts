import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /admin/checkout-links — list all checkout links (newest first)
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * POST /admin/checkout-links — create a checkout link (validated, via workflow)
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
