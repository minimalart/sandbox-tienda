import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/** GET /admin/fiscal-documents?owner_type=&owner_id= — historial del owner. */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/**
 * POST /admin/fiscal-documents — consulta ARCA, genera el PDF, lo almacena y
 * crea una versión nueva (archivando la anterior). Devuelve el documento nuevo,
 * el diff contra la versión previa y si hubo cambios.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
