import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/landing-pages/:id/ai-seo
 * Genera title/description/image/noindex y los guarda en `seo`.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
