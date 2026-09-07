import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /store/blog-categories — public list ordered by sort_order then name.
 * With `sales_channel_id` (demo context) devuelve SOLO las categorías que tienen
 * al menos un artículo publicado visible en ese canal (oculta las vacías).
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
