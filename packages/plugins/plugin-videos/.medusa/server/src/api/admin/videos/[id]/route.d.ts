import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AdminUpdateVideoType } from '../validators';
export declare const GET: (req: MedusaRequest, res: MedusaResponse) => Promise<void>;
export declare const POST: (req: MedusaRequest<AdminUpdateVideoType>, res: MedusaResponse) => Promise<void>;
export declare const DELETE: (req: MedusaRequest, res: MedusaResponse) => Promise<void>;
