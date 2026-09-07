import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
type LinkProductsInput = {
    product_ids: string[];
};
type UnlinkProductsInput = {
    product_ids: string[];
};
/**
 * POST /admin/brands/:brand_id/products
 * Link products to a brand
 */
export declare function POST(req: MedusaRequest<LinkProductsInput>, res: MedusaResponse): Promise<void>;
/**
 * DELETE /admin/brands/:brand_id/products
 * Unlink products from a brand
 */
export declare function DELETE(req: MedusaRequest<UnlinkProductsInput>, res: MedusaResponse): Promise<void>;
/**
 * GET /admin/brands/:brand_id/products
 * Get all products linked to a brand
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
