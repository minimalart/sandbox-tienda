import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/** Listado de beneficios con filtros (provider/status/type/source). */
export declare function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
/** Crea un beneficio manual. */
export declare function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
