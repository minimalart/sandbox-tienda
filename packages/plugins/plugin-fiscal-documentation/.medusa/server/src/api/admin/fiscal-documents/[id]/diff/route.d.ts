import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * GET /admin/fiscal-documents/:id/diff[?against=<otherId>] — diferencias entre
 * este documento y otro (o la versión inmediatamente anterior del mismo owner).
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
