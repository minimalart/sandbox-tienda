import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/banners/ai-image
 * Genera UNA imagen para un banner (nano banana vía OpenRouter), la optimiza a
 * WebP y la sube al File module (S3/DO Spaces). Stateless: devuelve la URL para
 * que el form la use en `media_url`. Reutiliza el pipeline de imágenes de
 * landing-page (generateImage + optimizeToWebp).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
