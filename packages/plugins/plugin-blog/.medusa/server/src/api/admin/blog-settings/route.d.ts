import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/** GET /admin/blog-settings — singleton config (created with defaults on first read). */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** POST /admin/blog-settings — update the singleton config. */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
