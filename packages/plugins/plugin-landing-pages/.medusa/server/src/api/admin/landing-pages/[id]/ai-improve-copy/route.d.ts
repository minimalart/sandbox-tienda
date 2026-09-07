import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/landing-pages/:id/ai-improve-copy
 * Mejora sólo los textos, conservando estructura/orden/links. Guarda el
 * resultado sin tocar el `status`.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
