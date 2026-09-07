import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AdminCreateVideoType } from './validators';
export declare const GET: (req: MedusaRequest, res: MedusaResponse) => Promise<void>;
export declare const POST: (req: MedusaRequest<AdminCreateVideoType>, res: MedusaResponse) => Promise<void>;
