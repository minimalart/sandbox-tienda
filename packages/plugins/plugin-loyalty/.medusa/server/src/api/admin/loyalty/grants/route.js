"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/loyalty/site-scope");
const loyalty_1 = require("../../../../modules/loyalty");
// Redemptions (reward grants) for the backoffice "Canjes" list.
async function GET(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const filters = {};
    if (req.query.status)
        filters.status = req.query.status;
    if (req.query.customer_id)
        filters.customer_id = req.query.customer_id;
    // El filtro va al WHERE: filtrar en memoria haría que `count` mienta y las
    // páginas salgan de tamaño variable.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_REWARD_GRANT_SITE_SCOPE));
    const [grants, count] = await service.listAndCountRewardGrants(filters, {
        relations: ['reward'],
        order: { created_at: 'DESC' },
        take: 100,
    });
    res.json({ grants, count });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvZ3JhbnRzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBUUEsa0JBZUM7QUF0QkQsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCx1RUFBeUY7QUFDekYseURBQTZEO0FBRzdELGdFQUFnRTtBQUN6RCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBNEIsRUFBRSxDQUFDO0lBQzVDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNO1FBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUN4RCxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVztRQUFFLE9BQU8sQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUM7SUFFdkUsMkVBQTJFO0lBQzNFLHFDQUFxQztJQUNyQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLElBQUEsa0JBQVUsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDRDQUErQixDQUFDLENBQUMsQ0FBQztJQUNqSCxNQUFNLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLHdCQUF3QixDQUFDLE9BQU8sRUFBRTtRQUN0RSxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUM7UUFDckIsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTtRQUM3QixJQUFJLEVBQUUsR0FBRztLQUNWLENBQUMsQ0FBQztJQUNILEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUM5QixDQUFDIn0=