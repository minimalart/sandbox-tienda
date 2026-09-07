"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const banner_1 = require("../../../modules/banner");
const create_banner_1 = require("../../../workflows/create-banner");
const validators_1 = require("./validators");
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/banner/site-scope");
/**
 * GET /admin/banners — list all banners (no filters, admin sees everything)
 */
async function GET(req, res) {
    try {
        const bannerService = req.scope.resolve(banner_1.BANNER_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const siteScope = await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BANNER_SITE_SCOPE);
        const [banners, count] = await bannerService.listAndCountBanners({ deleted_at: null, ...siteScope }, { skip: offset, take: limit, order: { priority: 'DESC' } });
        return res.status(200).json({ banners, count, offset, limit });
    }
    catch (error) {
        console.error('[Admin Banners] Error listing banners:', error);
        return res.status(500).json({ message: 'Error fetching banners' });
    }
}
/**
 * POST /admin/banners — create a banner (validated, via workflow with audit trail)
 */
async function POST(req, res) {
    try {
        const validated = validators_1.PostAdminCreateBanner.parse(req.body);
        const { result } = await (0, create_banner_1.createBannerWorkflow)(req.scope).run({
            input: {
                ...validated,
                user_id: req.auth_context?.actor_id,
            },
        });
        return res.status(201).json({ banner: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error creating banner';
        console.error('[Admin Banners] Error creating banner:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jhbm5lcnMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFZQSxrQkFnQkM7QUFLRCxvQkFpQkM7QUFqREQsb0RBQXdEO0FBRXhELG9FQUF3RTtBQUN4RSw2Q0FBcUQ7QUFDckQsNkRBQWtFO0FBQ2xFLHlEQUEyRDtBQUMzRCxtRUFBdUU7QUFFdkU7O0dBRUc7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxhQUFhLEdBQXdCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLHNCQUFhLENBQUMsQ0FBQztRQUM1RSxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM3RCxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRCxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUEsa0JBQVUsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDhCQUFpQixDQUFDLENBQUM7UUFFN0YsTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLGFBQWEsQ0FBQyxtQkFBbUIsQ0FDOUQsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLEdBQUcsU0FBUyxFQUFFLEVBQ2xDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUMzRCxDQUFDO1FBQ0YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQy9ELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxTQUFTLEdBQUcsa0NBQXFCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV4RCxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLG9DQUFvQixFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDM0QsS0FBSyxFQUFFO2dCQUNMLEdBQUcsU0FBUztnQkFDWixPQUFPLEVBQUcsR0FBVyxDQUFDLFlBQVksRUFBRSxRQUFRO2FBQzdDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsdUJBQXVCLENBQUM7UUFDakYsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9