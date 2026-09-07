import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
export declare function POST(req: AuthenticatedMedusaRequest<{
    productId?: string;
    productVariantId?: string;
    quantity?: number;
}>, res: MedusaResponse): Promise<void>;
export declare function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
