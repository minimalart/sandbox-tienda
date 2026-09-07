import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/landing-pages/:id/ai-translate
 * Traduce los textos al locale destino conservando estructura/links/handles.
 * Guarda el resultado sin tocar el `status`.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
