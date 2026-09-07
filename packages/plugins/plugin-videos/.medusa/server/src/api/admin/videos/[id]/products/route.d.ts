import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AdminLinkProductsType, AdminUnlinkProductsType } from '../../validators';
export declare const GET: (req: MedusaRequest, res: MedusaResponse) => Promise<void>;
export declare const POST: (req: MedusaRequest<AdminLinkProductsType>, res: MedusaResponse) => Promise<void>;
export declare const DELETE: (req: MedusaRequest<AdminUnlinkProductsType>, res: MedusaResponse) => Promise<void>;
