import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** POST /admin/blog-posts/:id/publish — set status=published + stamp published_at. */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
