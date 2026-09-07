import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /admin/banners/:id
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * POST /admin/banners/:id — update a banner (validated, via workflow with audit trail)
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * DELETE /admin/banners/:id — delete via workflow (with audit trail)
 */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
