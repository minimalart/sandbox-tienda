import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/landing-pages/:id/ai-image
 * Genera UNA imagen (nano banana vía OpenRouter) para un slot del puck_data,
 * la optimiza a WebP, la sube al File module y reemplaza la URL en el bloque.
 * Per-imagen a propósito (la UI itera los slots vacíos con progreso).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
