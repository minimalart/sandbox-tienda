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
    if (req.query.event)
        filters.event = req.query.event;
    // El filtro va al WHERE: filtrar en memoria haría que `count` mienta y las
    // páginas salgan de tamaño variable.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_EARN_RULE_SITE_SCOPE));
    const [rules, count] = await service.listAndCountEarnRules(filters, {
        order: { priority: 'DESC', created_at: 'DESC' },
    });
    res.json({ rules, count });
}
async function POST(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const created = await service.createEarnRules(req.validatedBody);
    res.status(201).json({ rule: created });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvcnVsZXMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxrQkFhQztBQUVELG9CQUlDO0FBekJELGdFQUFxRTtBQUNyRSw0REFBOEQ7QUFDOUQsdUVBQXNGO0FBQ3RGLHlEQUE2RDtBQUd0RCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBNEIsRUFBRSxDQUFDO0lBQzVDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVO1FBQUUsT0FBTyxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztJQUNwRSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSztRQUFFLE9BQU8sQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7SUFFckQsMkVBQTJFO0lBQzNFLHFDQUFxQztJQUNyQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLElBQUEsa0JBQVUsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHlDQUE0QixDQUFDLENBQUMsQ0FBQztJQUM5RyxNQUFNLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sRUFBRTtRQUNsRSxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7S0FDaEQsQ0FBQyxDQUFDO0lBQ0gsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQzdCLENBQUM7QUFFTSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLGFBQXdDLENBQUMsQ0FBQztJQUM1RixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQzFDLENBQUMifQ==