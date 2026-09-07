import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { StoreUpdateCommentType } from '../validators';
export declare function PUT(req: AuthenticatedMedusaRequest<StoreUpdateCommentType>, res: MedusaResponse): Promise<void>;
export declare function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
