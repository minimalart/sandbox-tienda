import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/** GET /admin/fiscal-documents/:id — un documento. */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/**
 * DELETE /admin/fiscal-documents/:id — baja lógica (soft delete). No borra el
 * PDF del File module ni rompe el historial; solo lo oculta de los listados.
 */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void>;
