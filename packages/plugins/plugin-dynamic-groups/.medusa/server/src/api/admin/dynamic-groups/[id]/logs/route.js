"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/dynamic-groups/site-scope");
const dynamic_groups_1 = require("../../../../../modules/dynamic-groups");
async function GET(req, res) {
    // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
    // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.DYNAMIC_GROUP_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const [logs, count] = await service.listAndCountDynamicGroupMembershipLogs({ dynamic_group_id: req.params.id }, { skip: offset, take: limit, order: { created_at: 'DESC' } });
    res.json({ logs, count, limit, offset });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2R5bmFtaWMtZ3JvdXBzL1tpZF0vbG9ncy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLGtCQWlCQztBQXZCRCxtRUFBd0U7QUFDeEUsK0RBQXFFO0FBQ3JFLGlGQUE0RjtBQUM1RiwwRUFBOEU7QUFHdkUsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELDBFQUEwRTtJQUMxRSw0RUFBNEU7SUFDNUUsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxxQ0FBd0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRS9HLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUMvQixzQ0FBcUIsQ0FDdEIsQ0FBQztJQUNGLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM1QyxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFN0MsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxzQ0FBc0MsQ0FDeEUsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUNuQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDN0QsQ0FBQztJQUVGLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQzNDLENBQUMifQ==