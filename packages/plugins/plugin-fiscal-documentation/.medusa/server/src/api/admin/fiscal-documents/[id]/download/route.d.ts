import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * GET /admin/fiscal-documents/:id/download — streamea el PDF por el backend.
 * Los PDFs se suben privados (no expone la URL pública del bucket); este proxy
 * autenticado los sirve same-origin.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
