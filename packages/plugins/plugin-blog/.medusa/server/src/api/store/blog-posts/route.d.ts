import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /store/blog-posts — public, PUBLISHED posts only. Supports `category_id`,
 * `q`, `limit`/`offset`. Ordered by published_at desc. Returns card projections
 * (no body) to keep the list response light.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
