"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const banner_1 = require("../../../../modules/banner");
const delete_banner_1 = require("../../../../workflows/delete-banner");
const update_banner_1 = require("../../../../workflows/update-banner");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/banner/site-scope");
const validators_1 = require("../validators");
/**
 * GET /admin/banners/:id
 */
async function GET(req, res) {
    try {
        const bannerService = req.scope.resolve(banner_1.BANNER_MODULE);
        const banner = await bannerService.retrieveBanner(req.params.id);
        (0, scope_1.assertRowInSite)(banner, await (0, request_1.siteFromRequest)(req), site_scope_1.BANNER_SITE_SCOPE);
        return res.status(200).json({ banner });
    }
    catch (error) {
        console.error('[Admin Banners] Error retrieving banner:', error);
        return res.status(404).json({ message: 'Banner not found' });
    }
}
/**
 * POST /admin/banners/:id — update a banner (validated, via workflow with audit trail)
 */
async function POST(req, res) {
    try {
        const validated = validators_1.PostAdminUpdateBanner.parse(req.body);
        const bannerService = req.scope.resolve(banner_1.BANNER_MODULE);
        (0, scope_1.assertRowInSite)((await bannerService.retrieveBanner(req.params.id)), await (0, request_1.siteFromRequest)(req), site_scope_1.BANNER_SITE_SCOPE);
        const { result } = await (0, update_banner_1.updateBannerWorkflow)(req.scope).run({
            input: {
                id: req.params.id,
                data: validated,
                user_id: req.auth_context?.actor_id,
            },
        });
        return res.status(200).json({ banner: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error updating banner';
        console.error('[Admin Banners] Error updating banner:', message);
        return res.status(400).json({ message });
    }
}
/**
 * DELETE /admin/banners/:id — delete via workflow (with audit trail)
 */
async function DELETE(req, res) {
    try {
        const bannerService = req.scope.resolve(banner_1.BANNER_MODULE);
        (0, scope_1.assertRowInSite)((await bannerService.retrieveBanner(req.params.id)), await (0, request_1.siteFromRequest)(req), site_scope_1.BANNER_SITE_SCOPE);
        const { result } = await (0, delete_banner_1.deleteBannerWorkflow)(req.scope).run({
            input: {
                id: req.params.id,
                user_id: req.auth_context?.actor_id,
            },
        });
        return res.status(200).json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error deleting banner';
        console.error('[Admin Banners] Error deleting banner:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jhbm5lcnMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLGtCQVVDO0FBS0Qsb0JBeUJDO0FBS0Qsd0JBc0JDO0FBL0VELHVEQUEyRDtBQUUzRCx1RUFBMkU7QUFDM0UsdUVBQTJFO0FBQzNFLGdFQUFxRTtBQUNyRSw0REFBbUU7QUFDbkUsc0VBQTBFO0FBQzFFLDhDQUFzRDtBQUV0RDs7R0FFRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLGFBQWEsR0FBd0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsc0JBQWEsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sTUFBTSxHQUFHLE1BQU0sYUFBYSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO1FBQzNFLElBQUEsdUJBQWUsRUFBQyxNQUFpQyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDhCQUFpQixDQUFDLENBQUM7UUFDbEcsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDBDQUEwQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2pFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0lBQy9ELENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVB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