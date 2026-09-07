"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/dynamic-groups/site-scope");
const dynamic_groups_1 = require("../../../modules/dynamic-groups");
const create_dynamic_group_1 = require("../../../workflows/create-dynamic-group");
const validators_1 = require("./validators");
async function GET(req, res) {
    const service = req.scope.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const resolution = await (0, request_1.siteFromRequest)(req);
    const [dynamic_groups, count] = await service.listAndCountDynamicGroups(await (0, scope_1.siteFilter)(req.scope, resolution, site_scope_1.DYNAMIC_GROUP_SITE_SCOPE), { skip: offset, take: limit, order: { created_at: 'DESC' } });
    res.json({ dynamic_groups, count, limit, offset });
}
async function POST(req, res) {
    const parsed = validators_1.PostCreateDynamicGroup.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
        return;
    }
    // El grupo nace en la tienda activa: si no, se crea desde una tienda y aparece en
    // todas, y el listado filtrado ya no lo encuentra donde se creó.
    const { result } = await (0, create_dynamic_group_1.createDynamicGroupWorkflow)(req.scope).run({
        input: {
            ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.DYNAMIC_GROUP_SITE_SCOPE),
            ...parsed.data,
        },
    });
    res.status(201).json({ dynamic_group: result });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2R5bmFtaWMtZ3JvdXBzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBWUEsa0JBZUM7QUFFRCxvQkFpQkM7QUE3Q0QsNkRBQWtFO0FBQ2xFLHlEQUF5RTtBQUN6RSwyRUFBc0Y7QUFDdEYsb0VBQXdFO0FBRXhFLGtGQUdpRDtBQUNqRCw2Q0FBc0Q7QUFFL0MsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUMvQixzQ0FBcUIsQ0FDdEIsQ0FBQztJQUNGLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM1QyxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFN0MsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFFOUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyx5QkFBeUIsQ0FDckUsTUFBTSxJQUFBLGtCQUFVLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUscUNBQXdCLENBQUMsRUFDakUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQzdELENBQUM7SUFFRixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNyRCxDQUFDO0FBRU0sS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLE1BQU0sTUFBTSxHQUFHLG1DQUFzQixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDMUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUNyRixPQUFPO0lBQ1QsQ0FBQztJQUVELGtGQUFrRjtJQUNsRixpRUFBaUU7SUFDakUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxpREFBMEIsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ2pFLEtBQUssRUFBRTtZQUNMLEdBQUcsSUFBQSxvQkFBWSxFQUFDLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHFDQUF3QixDQUFDO1lBQ3JFLEdBQUcsTUFBTSxDQUFDLElBQUk7U0FDdUI7S0FDeEMsQ0FBQyxDQUFDO0lBRUgsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNsRCxDQUFDIn0=