"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/landing-page/site-scope");
const landing_page_1 = require("../../../../modules/landing-page");
const update_landing_page_1 = require("../../../../workflows/update-landing-page");
const validators_1 = require("../validators");
async function GET(req, res) {
    // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LANDING_PAGE_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(landing_page_1.LANDING_PAGE_MODULE);
    try {
        const landing_page = await service.retrieveLandingPage(req.params.id);
        return res.status(200).json({ landing_page });
    }
    catch {
        return res.status(404).json({ message: 'Landing page not found' });
    }
}
/** POST /admin/landing-pages/:id — update (partial). */
async function POST(req, res) {
    // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LANDING_PAGE_SITE_SCOPE, req.params.id);
    try {
        const validated = validators_1.PostAdminUpdateLandingPage.parse(req.body);
        const userId = req
            .auth_context?.actor_id;
        const { result } = await (0, update_landing_page_1.updateLandingPageWorkflow)(req.scope).run({
            input: {
                id: req.params.id,
                ...validated,
                updated_by: userId,
            },
        });
        return res.status(200).json({ landing_page: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error updating landing page';
        console.error('[Admin LandingPages] Error updating landing page:', message);
        return res.status(400).json({ message });
    }
}
/** DELETE /admin/landing-pages/:id — soft-delete. */
async function DELETE(req, res) {
    // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LANDING_PAGE_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(landing_page_1.LANDING_PAGE_MODULE);
    try {
        await service.softDeleteLandingPages(req.params.id);
        return res
            .status(200)
            .json({ id: req.params.id, object: 'landing_page', deleted: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error deleting landing page';
        console.error('[Admin LandingPages] Error deleting landing page:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVVBLGtCQWFDO0FBR0Qsb0JBd0JDO0FBR0Qsd0JBa0JDO0FBdEVELGdFQUFxRTtBQUNyRSw0REFBa0U7QUFDbEUsNEVBQXNGO0FBQ3RGLG1FQUF1RTtBQUd2RSxtRkFBc0Y7QUFDdEYsOENBQTJEO0FBRXBELEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCwwRUFBMEU7SUFDMUUsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxvQ0FBdUIsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRTlHLE1BQU0sT0FBTyxHQUE2QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FDekQsa0NBQW1CLENBQ3BCLENBQUM7SUFDRixJQUFJLENBQUM7UUFDSCxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQWEsQ0FBQyxDQUFDO1FBQ2xGLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLENBQUMsQ0FBQztJQUNyRSxDQUFDO0FBQ0gsQ0FBQztBQUVELHdEQUF3RDtBQUNqRCxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsMEVB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