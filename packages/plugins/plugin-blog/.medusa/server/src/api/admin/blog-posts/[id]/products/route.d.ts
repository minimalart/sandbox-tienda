import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** GET /admin/blog-posts/:id/products — ordered product ids for the post. */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * POST /admin/blog-posts/:id/products — replace the post's associations with
 * the given ordered `product_ids` (index becomes sort_order).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
