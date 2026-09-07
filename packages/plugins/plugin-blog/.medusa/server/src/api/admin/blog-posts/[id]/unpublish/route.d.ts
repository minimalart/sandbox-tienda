import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** POST /admin/blog-posts/:id/unpublish — revert to draft (keeps published_at). */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
