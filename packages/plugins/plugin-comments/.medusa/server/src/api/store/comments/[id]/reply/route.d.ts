import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { StoreReplyCommentType } from '../../validators';
export declare function POST(req: AuthenticatedMedusaRequest<StoreReplyCommentType>, res: MedusaResponse): Promise<void>;
