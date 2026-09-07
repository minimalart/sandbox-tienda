import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
export declare function POST(req: AuthenticatedMedusaRequest<{
    amount?: number;
}>, res: MedusaResponse): Promise<void>;
