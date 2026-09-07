"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const catalogador_1 = require("../../../../../../modules/catalogador");
const asset_cleanup_1 = require("../../../../../../modules/catalogador/asset-cleanup");
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/catalogador/site-scope");
/** POST /admin/catalogador/executions/:id/cancel — cancela antes de aplicar (PRD §8). */
async function POST(req, res) {
    // El mismo guard que el detalle: cancelar la corrida de otra tienda le corta un
    // proceso que no lanzó, y el estado `cancelled` no tiene vuelta atrás desde acá.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    const actorId = req.auth_context?.actor_id ?? null;
    let execution;
    try {
        execution = await service.retrieveCatalogingExecution(id);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
        return;
    }
    const blocked = ['applied', 'partially_applied', 'applying', 'restored'];
    if (blocked.includes(execution.status)) {
        res.status(409).json({
            type: 'not_allowed',
            message: `No se puede cancelar una ejecución en estado "${execution.status}".`,
        });
        return;
    }
    await service.setStatus(id, 'cancelled');
    // Cancelar deja de ser gratis en storage: los estados bloqueados de arriba
    // garantizan que nada se aplicó, así que TODO lo que la corrida generó es residuo.
    const swept = await (0, asset_cleanup_1.cleanupExecutionFiles)(req.scope, id);
    await service.logActivity({
        execution_id: id,
        type: 'cancelled',
        actor_id: actorId,
        metadata: swept.proposals ? { files_deleted: swept.deleted, proposals: swept.proposals } : null,
    });
    const execAfter = await service.retrieveCatalogingExecution(id);
    res.status(200).json({ execution: execAfter });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9jYW5jZWwvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFVQSxvQkF1Q0M7QUFoREQsdUVBQTJFO0FBRTNFLHVGQUE0RjtBQUU1RixzRUFBMkU7QUFDM0Usa0VBQXdFO0FBQ3hFLGlGQUFtRztBQUVuRyx5RkFBeUY7QUFDbEYsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLGdGQUFnRjtJQUNoRixpRkFBaUY7SUFDakYsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSw0Q0FBK0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRXRILE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEyQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQ2hGLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sT0FBTyxHQUNWLEdBQTJELENBQUMsWUFBWSxFQUFFLFFBQVEsSUFBSSxJQUFJLENBQUM7SUFFOUYsSUFBSSxTQUFTLENBQUM7SUFDZCxJQUFJLENBQUM7UUFDSCxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsMkJBQTJCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsQ0FBQyxDQUFDO1FBQ2hGLE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsQ0FBQyxTQUFTLEVBQUUsbUJBQW1CLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3pFLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsTUFBZ0IsQ0FBQyxFQUFFLENBQUM7UUFDakQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDbkIsSUFBSSxFQUFFLGFBQWE7WUFDbkIsT0FBTyxFQUFFLGlEQUFpRCxTQUFTLENBQUMsTUFBTSxJQUFJO1NBQy9FLENBQUMsQ0FBQztRQUNILE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUN6QywyRUFBMkU7SUFDM0UsbUZBQW1GO0lBQ25GLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBQSxxQ0FBcUIsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUN4QixZQUFZLEVBQUUsRUFBRTtRQUNoQixJQUFJLEVBQUUsV0FBVztRQUNqQixRQUFRLEVBQUUsT0FBTztRQUNqQixRQUFRLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJO0tBQ2hHLENBQUMsQ0FBQztJQUNILE1BQU0sU0FBUyxHQUFHLE1BQU0sT0FBTyxDQUFDLDJCQUEyQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2hFLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7QUFDakQsQ0FBQyJ9