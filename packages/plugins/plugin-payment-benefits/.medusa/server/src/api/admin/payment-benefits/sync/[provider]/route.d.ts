import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/** Dispara la sincronización de un proveedor (PRD §13: POST /sync/provider/{id}). */
export declare function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
