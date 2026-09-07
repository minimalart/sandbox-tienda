"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/loyalty/site-scope");
const loyalty_1 = require("../../../../../modules/loyalty");
async function GET(req, res) {
    // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
    // dejar la mutación abierta esconde la fila de la otra tienda pero deja
    // editarla con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_EARN_RULE_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const rule = await service.retrieveEarnRule(req.params.id);
    res.json({ rule });
}
async function POST(req, res) {
    // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
    // dejar la mutación abierta esconde la fila de la otra tienda pero deja
    // editarla con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_EARN_RULE_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const updated = await service.updateEarnRules({
        id: req.params.id,
        ...req.validatedBody,
    });
    res.json({ rule: updated });
}
async function DELETE(req, res) {
    // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
    // dejar la mutación abierta esconde la fila de la otra tienda pero deja
    // editarla con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_EARN_RULE_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    await service.deleteEarnRules([req.params.id]);
    res.json({ id: req.params.id, object: 'loyalty_earn_rule', deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvcnVsZXMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLGtCQVNDO0FBRUQsb0JBWUM7QUFFRCx3QkFTQztBQXhDRCxtRUFBd0U7QUFDeEUsK0RBQXFFO0FBQ3JFLDBFQUF5RjtBQUN6Riw0REFBZ0U7QUFHekQsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELDZFQUE2RTtJQUM3RSx3RUFBd0U7SUFDeEUsaUNBQWlDO0lBQ2pDLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUseUNBQTRCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUVuSCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sSUFBSSxHQUFHLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFDckUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDckIsQ0FBQztBQUVNLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSw2RUFBNkU7SUFDN0Usd0VBQXdFO0lBQ3hFLGlDQUFpQztJQUNqQyxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHlDQUE0QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFbkgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQUM7UUFDNUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUNqQixHQUFJLEdBQUcsQ0FBQyxhQUF5QztLQUNsRCxDQUFDLENBQUM7SUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDOUIsQ0FBQztBQUVNLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNsRSw2RUFBNkU7SUFDN0Usd0VBQXdFO0lBQ3hFLGlDQUFpQztJQUNqQyxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHlDQUE0QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFbkgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDL0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsQ0FBQyJ9