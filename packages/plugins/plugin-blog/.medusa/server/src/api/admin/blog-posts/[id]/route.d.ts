import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** GET /admin/blog-posts/:id — retrieve a post + its ordered product ids. */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** POST /admin/blog-posts/:id — partial update. */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** DELETE /admin/blog-posts/:id — soft-delete (and its product links). */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
