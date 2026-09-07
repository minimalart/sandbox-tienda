"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/landing-page/site-scope");
const landing_page_1 = require("../../../modules/landing-page");
const create_landing_page_1 = require("../../../workflows/create-landing-page");
const validators_1 = require("./validators");
/**
 * GET /admin/landing-pages — paginated list (limit, offset, status, q).
 * `q` matches title/slug case-insensitively. Returns
 * { landing_pages, count, limit, offset }, newest update first.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(landing_page_1.LANDING_PAGE_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const filters = {};
        if (status) {
            filters.status = status;
        }
        if (q) {
            filters.$or = [
                { title: { $ilike: `%${q}%` } },
                { slug: { $ilike: `%${q}%` } },
            ];
        }
        const resolution = await (0, request_1.siteFromRequest)(req);
        Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, resolution, site_scope_1.LANDING_PAGE_SITE_SCOPE));
        const [landing_pages, count] = await service.listAndCountLandingPages(filters, { skip: offset, take: limit, order: { updated_at: 'DESC' } });
        return res.status(200).json({ landing_pages, count, limit, offset });
    }
    catch (error) {
        console.error('[Admin LandingPages] Error listing landing pages:', error);
        return res.status(500).json({ message: 'Error fetching landing pages' });
    }
}
/**
 * POST /admin/landing-pages — create a landing page (zod-validated, via
 * workflow). Slug is generated from the title when omitted and de-duplicated.
 */
async function POST(req, res) {
    try {
        const validated = validators_1.PostAdminCreateLandingPage.parse(req.body);
        const userId = req
            .auth_context?.actor_id;
        /**
         * Los defaults van PRIMERO: un `sales_channel_id` explícito en el body gana.
         * Al revés, el default pisaría siempre y el campo del formulario sería
         * decorativo.
         */
        const { result } = await (0, create_landing_page_1.createLandingPageWorkflow)(req.scope).run({
            input: {
                ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.LANDING_PAGE_SITE_SCOPE),
                ...validated,
                created_by: userId,
            },
        });
        return res.status(201).json({ landing_page: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error creating landing page';
        console.error('[Admin LandingPages] Error creating landing page:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFlQSxrQkFtQ0M7QUFNRCxvQkEwQkM7QUFqRkQsNkRBQWtFO0FBQ2xFLHlEQUF5RTtBQUN6RSx5RUFBbUY7QUFDbkYsZ0VBQW9FO0FBR3BFLGdGQUFtRjtBQUNuRiw2Q0FBMEQ7QUFFMUQ7Ozs7R0FJRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBNkIsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQ3pELGtDQUFtQixDQUNwQixDQUFDO1FBQ0YsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDN0QsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0QsTUFBTSxNQUFNLEdBQ1YsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDdEUsTUFBTSxDQUFDLEdBQUcsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENB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