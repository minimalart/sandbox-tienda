import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { StoreCreateCommentType } from './validators';
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: AuthenticatedMedusaRequest<StoreCreateCommentType>, res: MedusaResponse): Promise<void>;
