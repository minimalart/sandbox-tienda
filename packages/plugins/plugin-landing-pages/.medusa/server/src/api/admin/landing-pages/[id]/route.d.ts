import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** POST /admin/landing-pages/:id — update (partial). */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/** DELETE /admin/landing-pages/:id — soft-delete. */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
