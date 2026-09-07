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
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_TIER_SITE_SCOPE));
    const [tiers, count] = await service.listAndCountTiers(filters, { order: { threshold: 'ASC' } });
    res.json({ tiers, count });
}
async function POST(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const created = await service.createTiers(req.validatedBody);
    res.status(201).json({ tier: created });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvdGllcnMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxrQkFVQztBQUVELG9CQUlDO0FBdEJELGdFQUFxRTtBQUNyRSw0REFBOEQ7QUFDOUQsdUVBQWlGO0FBQ2pGLHlEQUE2RDtBQUd0RCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBNEIsRUFBRSxDQUFDO0lBQzVDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVO1FBQUUsT0FBTyxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztJQUVwRSwyRUFBMkU7SUFDM0UscUNBQXFDO0lBQ3JDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sSUFBQSxrQkFBVSxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsb0NBQXVCLENBQUMsQ0FBQyxDQUFDO0lBQ3pHLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNqRyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVNLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsYUFBd0MsQ0FBQyxDQUFDO0lBQ3hGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDMUMsQ0FBQyJ9