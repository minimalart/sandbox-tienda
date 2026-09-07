"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/dynamic-groups/site-scope");
const utils_1 = require("@medusajs/framework/utils");
const dynamic_groups_1 = require("../../../../modules/dynamic-groups");
const validators_1 = require("../validators");
async function GET(req, res) {
    // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
    // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.DYNAMIC_GROUP_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const group = await service.retrieveDynamicGroup(req.params.id);
    res.json({ dynamic_group: group });
}
async function POST(req, res) {
    // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
    // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.DYNAMIC_GROUP_SITE_SCOPE, req.params.id);
    const parsed = validators_1.PostUpdateDynamicGroup.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
        return;
    }
    const service = req.scope.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const id = req.params.id;
    const existing = await service.retrieveDynamicGroup(id);
    const updated = await service.updateDynamicGroups({ id, ...parsed.data });
    // Mantener el nombre del customer_group nativo en sync.
    const cgId = existing?.customer_group_id;
    if (parsed.data.name && cgId) {
        try {
            const customerService = req.scope.resolve(utils_1.Modules.CUSTOMER);
            await customerService.updateCustomerGroups(cgId, {
                name: parsed.data.name,
            });
        }
        catch {
            /* best-effort */
        }
    }
    res.json({ dynamic_group: updated });
}
async function DELETE(req, res) {
    // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
    // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.DYNAMIC_GROUP_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const id = req.params.id;
    const existing = await service.retrieveDynamicGroup(id);
    // Borra también el customer_group nativo (libera a los miembros).
    const cgId = existing?.customer_group_id;
    if (cgId) {
        try {
            const customerService = req.scope.resolve(utils_1.Modules.CUSTOMER);
            await customerService.deleteCustomerGroups([cgId]);
        }
        catch {
            /* best-effort */
        }
    }
    await service.deleteDynamicGroups([id]);
    res.json({ id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2R5bmFtaWMtZ3JvdXBzL1tpZF0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFTQSxrQkFVQztBQUVELG9CQWlDQztBQUVELHdCQXdCQztBQS9FRCxnRUFBcUU7QUFDckUsNERBQWtFO0FBQ2xFLDhFQUF5RjtBQUN6RixxREFBb0Q7QUFDcEQsdUVBQTJFO0FBRTNFLDhDQUF1RDtBQUVoRCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsMEVBQTBFO0lBQzFFLDRFQUE0RTtJQUM1RSxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHFDQUF3QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFL0csTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQy9CLHNDQUFxQixDQUN0QixDQUFDO0lBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUMxRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUVNLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSwwRUFBMEU7SUFDMUUsNEVBQTRFO0lBQzVFLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUscUNBQXdCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUUvRyxNQUFNLE1BQU0s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