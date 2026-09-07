import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /admin/blog-posts — paginated list (limit, offset, status, category_id, q).
 * `q` matches title/excerpt/slug case-insensitively. Newest first.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** POST /admin/blog-posts — create a post. Slug generated from title when omitted. */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
