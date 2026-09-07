import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AdminVimeoUploadBodyType } from '../validators';
export declare const POST: (req: MedusaRequest<AdminVimeoUploadBodyType>, res: MedusaResponse) => Promise<void>;
