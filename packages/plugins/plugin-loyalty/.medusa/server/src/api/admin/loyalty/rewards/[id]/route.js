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
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_REWARD_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const reward = await service.retrieveReward(req.params.id);
    res.json({ reward });
}
async function POST(req, res) {
    // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
    // dejar la mutación abierta esconde la fila de la otra tienda pero deja
    // editarla con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_REWARD_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const updated = await service.updateRewards({
        id: req.params.id,
        ...req.validatedBody,
    });
    res.json({ reward: updated });
}
async function DELETE(req, res) {
    // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
    // dejar la mutación abierta esconde la fila de la otra tienda pero deja
    // editarla con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.LOYALTY_REWARD_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    await service.deleteRewards([req.params.id]);
    res.json({ id: req.params.id, object: 'loyalty_reward', deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvcmV3YXJkcy9baWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBT0Esa0JBU0M7QUFFRCxvQkFZQztBQUVELHdCQVNDO0FBeENELG1FQUF3RTtBQUN4RSwrREFBcUU7QUFDckUsMEVBQXNGO0FBQ3RGLDREQUFnRTtBQUd6RCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsNkVBQTZFO0lBQzdFLHdFQUF3RTtJQUN4RSxpQ0FBaUM7SUFDakMsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxzQ0FBeUIsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRWhILE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF1Qix3QkFBYyxDQUFDLENBQUM7SUFDeEUsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFDckUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUVNLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSw2RUFBNkU7SUFDN0Usd0VBQXdFO0lBQ3hFLGlDQUFpQztJQUNqQyxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHNDQUF5QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFaEgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxhQUFhLENBQUM7UUFDMUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUNqQixHQUFJLEdBQUcsQ0FBQyxhQUF5QztLQUNsRCxDQUFDLENBQUM7SUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUVNLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNsRSw2RUFBNkU7SUFDN0Usd0VBQXdFO0lBQ3hFLGlDQUFpQztJQUNqQyxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHNDQUF5QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFaEgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDN0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDM0UsQ0FBQyJ9