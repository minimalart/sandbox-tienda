import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /store/blog-posts/:slug — public, single PUBLISHED post by slug, plus its
 * ordered product ids and up to 4 related posts (same category). 404 when not
 * found/published. `?preview=true` also resolves drafts (used by the admin's
 * "Vista previa"); guard behind the admin in production if drafts are sensitive.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
