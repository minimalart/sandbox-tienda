import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** POST /admin/blog-posts/:id/duplicate — clone as a fresh draft (incl. products). */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
