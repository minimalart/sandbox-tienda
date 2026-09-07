import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * Proxy same-origin para el editor de imágenes: descarga un asset (S3/CDN) y lo
 * re-sirve desde el mismo origen del admin, así el <canvas> no queda "tainted"
 * por CORS al hacer toBlob() sobre imágenes de S3 sin headers CORS.
 *
 * GET /admin/media-library/proxy?url=<asset_url>
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
