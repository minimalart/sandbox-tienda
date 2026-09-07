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
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_REWARD_SITE_SCOPE));
    const [rewards, count] = await service.listAndCountRewards(filters, {
        order: { cost_points: 'ASC' },
    });
    res.json({ rewards, count });
}
async function POST(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const created = await service.createRewards(req.validatedBody);
    res.status(201).json({ reward: created });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvcmV3YXJkcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLGtCQVlDO0FBRUQsb0JBSUM7QUF4QkQsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCx1RUFBbUY7QUFDbkYseURBQTZEO0FBR3RELEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sT0FBTyxHQUE0QixFQUFFLENBQUM7SUFDNUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVU7UUFBRSxPQUFPLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO0lBRXBFLDJFQUEyRTtJQUMzRSxxQ0FBcUM7SUFDckMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxJQUFBLGtCQUFVLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxzQ0FBeUIsQ0FBQyxDQUFDLENBQUM7SUFDM0csTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUU7UUFDbEUsS0FBSyxFQUFFLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRTtLQUM5QixDQUFDLENBQUM7SUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDL0IsQ0FBQztBQUVNLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsYUFBd0MsQ0FBQyxDQUFDO0lBQzFGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDNUMsQ0FBQyJ9