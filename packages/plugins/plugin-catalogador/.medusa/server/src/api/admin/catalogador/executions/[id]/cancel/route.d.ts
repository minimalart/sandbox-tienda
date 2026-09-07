import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/** POST /admin/catalogador/executions/:id/cancel — cancela antes de aplicar (PRD §8). */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
