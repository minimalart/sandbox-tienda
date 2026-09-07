"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const points_1 = require("../../../../modules/points");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/loyalty/site-scope");
// Paginated ledger movements for the backoffice "Movimientos" list.
async function GET(req, res) {
    const points = req.scope.resolve(points_1.POINTS_MODULE);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const [movements, count] = await points.listAndCountPointsTransactions({ ...(await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.POINTS_TRANSACTION_SITE_SCOPE)) }, { take: limit, skip: offset, order: { created_at: 'DESC' } });
    res.json({ movements, count, limit, offset });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvbW92ZW1lbnRzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBU0Esa0JBU0M7QUFqQkQsdURBQTJEO0FBRzNELGdFQUFxRTtBQUNyRSw0REFBOEQ7QUFDOUQsdUVBQXVGO0FBRXZGLG9FQUFvRTtBQUM3RCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXNCLHNCQUFhLENBQUMsQ0FBQztJQUNyRSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMzRCxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0MsTUFBTSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE1BQU0sQ0FBQyw4QkFBOEIsQ0FDcEUsRUFBRSxHQUFHLENBQUMsTUFBTSxJQUFBLGtCQUFVLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSwwQ0FBNkIsQ0FBQyxDQUFDLEVBQUUsRUFDL0YsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQzdELENBQUM7SUFDRixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNoRCxDQUFDIn0=