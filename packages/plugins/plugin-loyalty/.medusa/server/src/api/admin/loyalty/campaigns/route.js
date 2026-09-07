"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/loyalty/site-scope");
const loyalty_1 = require("../../../../modules/loyalty");
async function GET(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const filters = {};
    if (req.query.program_id)
        filters.program_id = req.query.program_id;
    // El filtro va al WHERE: filtrar en memoria haría que `count` mienta y las
    // páginas salgan de tamaño variable.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_CAMPAIGN_SITE_SCOPE));
    const [campaigns, count] = await service.listAndCountCampaigns(filters, {
        order: { priority: 'DESC', created_at: 'DESC' },
    });
    res.json({ campaigns, count });
}
async function POST(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const created = await service.createCampaigns(req.validatedBody);
    res.status(201).json({ campaign: created });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvY2FtcGFpZ25zL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBT0Esa0JBWUM7QUFFRCxvQkFJQztBQXhCRCxnRUFBcUU7QUFDckUsNERBQThEO0FBQzlELHVFQUFxRjtBQUNyRix5REFBNkQ7QUFHdEQsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF1Qix3QkFBYyxDQUFDLENBQUM7SUFDeEUsTUFBTSxPQUFPLEdBQTRCLEVBQUUsQ0FBQztJQUM1QyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVTtRQUFFLE9BQU8sQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUM7SUFFcEUsMkVBQTJFO0lBQzNFLHFDQUFxQztJQUNyQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLElBQUEsa0JBQVUsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHdDQUEyQixDQUFDLENBQUMsQ0FBQztJQUM3RyxNQUFNLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sRUFBRTtRQUN0RSxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7S0FDaEQsQ0FBQyxDQUFDO0lBQ0gsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFTSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLGFBQXdDLENBQUMsQ0FBQztJQUM1RixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQzlDLENBQUMifQ==