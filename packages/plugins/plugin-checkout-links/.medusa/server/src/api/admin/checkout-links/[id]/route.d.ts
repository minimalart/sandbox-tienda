import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /admin/checkout-links/:id
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * POST /admin/checkout-links/:id — update (status, expiry, items, etc.)
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * DELETE /admin/checkout-links/:id
 */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
