import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * GET /admin/pdf-catalogs/file?id=<file_id> — streamea el PDF por el backend.
 *
 * El bucket (DO Spaces) no manda headers CORS, así que react-pdf no puede
 * fetchear la URL pública desde el admin; este proxy same-origin lo evita.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
