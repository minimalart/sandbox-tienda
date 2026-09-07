import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** GET /admin/blog-categories — list ordered by sort_order then name. */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** POST /admin/blog-categories — create. Slug generated from name when omitted. */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
