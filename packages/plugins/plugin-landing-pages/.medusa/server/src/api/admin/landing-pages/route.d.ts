import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /admin/landing-pages — paginated list (limit, offset, status, q).
 * `q` matches title/slug case-insensitively. Returns
 * { landing_pages, count, limit, offset }, newest update first.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
/**
 * POST /admin/landing-pages — create a landing page (zod-validated, via
 * workflow). Slug is generated from the title when omitted and de-duplicated.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
