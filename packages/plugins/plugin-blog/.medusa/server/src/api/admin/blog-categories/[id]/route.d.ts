import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** GET /admin/blog-categories/:id */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** POST /admin/blog-categories/:id — partial update. */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** DELETE /admin/blog-categories/:id — soft-delete. */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
