import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { AdminUpdateCommentSettingsType } from '../validators';
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: MedusaRequest<AdminUpdateCommentSettingsType>, res: MedusaResponse): Promise<void>;
