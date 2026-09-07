"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const catalogador_1 = require("../../../../../../modules/catalogador");
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/catalogador/site-scope");
/**
 * POST /admin/catalogador/executions/:id/apply
 *
 * Marca la ejecución como `applying`. La aplicación real (snapshots + update de
 * productos, con detección de conflictos y éxito parcial) corre en segundo plano
 * (job catalogador-process → applyExecution). Sólo se aplican productos con
 * status 'accepted' (PRD §18.1).
 */
async function POST(req, res) {
    // El mismo guard que el detalle: aplicar es la mutación MÁS cara del módulo —
    // reescribe campos del catálogo y deja snapshots—, así que dispararla sobre la
    // corrida de otra tienda le cambia productos a alguien que ni se entera.
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
    // `applied` está en la lista y es seguro: el guard de abajo corta con 409 si no
    // hay NINGÚN producto en estado `accepted`, y un producto ya aplicado queda en
    // `applied`, no en `accepted`. O sea, re-aplicar desde una corrida aplicada sólo
    // puede levantar aprobaciones nuevas — nunca reescribir lo que ya se escribió.
    // Sin esto, todo lo aprobado después de un apply quedaba muerto: 409 por API y
    // botón oculto en el detalle.
    const allowed = [
        'pending_review',
        'partially_reviewed',
        'ready_to_apply',
        'partially_applied',
        'applied',
    ];
    if (!allowed.includes(execution.status)) {
        res.status(409).json({
            type: 'not_allowed',
            message: `No se puede aplicar desde el estado "${execution.status}".`,
        });
        return;
    }
    const accepted = await service.listCatalogingExecutionProducts({ execution_id: id, status: 'accepted' }, { take: 1 });
    if (accepted.length === 0) {
        res.status(409).json({
            type: 'not_allowed',
            message: 'No hay cambios aceptados para aplicar.',
        });
        return;
    }
    await service.setStatus(id, 'applying');
    await service.logActivity({ execution_id: id, type: 'apply_started', actor_id: actorId });
    const execAfter = await service.retrieveCatalogingExecution(id);
    res.status(202).json({ execution: execAfter });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9hcHBseS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWdCQSxvQkF5REM7QUF4RUQsdUVBQTJFO0FBRzNFLHNFQUEyRTtBQUMzRSxrRUFBd0U7QUFDeEUsaUZBQW1HO0FBRW5HOzs7Ozs7O0dBT0c7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsOEVBQThFO0lBQzlFLCtFQUErRTtJQUMvRSx5RUFBeUU7SUFDekUsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSw0Q0FBK0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRXRILE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEyQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQ2hGLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sT0FBTyxHQUNWLEdBQTJELENBQUMsWUFBWSxFQUFFLFFBQVEsSUFBSSxJQUFJLENBQUM7SUFFOUYsSUFBSSxTQUFTLENBQUM7SUFDZCxJQUFJLENBQUM7UUFDSCxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsMkJBQTJCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsQ0FBQyxDQUFDO1FBQ2hGLE9BQU87SUFDVCxDQUFDO0lBRUQsZ0ZBQWdGO0lBQ2hGLCtFQUErRTtJQUMvRSxpRkFBaUY7SUFDakYsK0VBQStFO0lBQy9FLCtFQUErRTtJQUMvRSw4QkFBOEI7SUFDOUIsTUFBTSxPQUFPLEdBQUc7UUFDZCxnQkFBZ0I7UUFDaEIsb0JBQW9CO1FBQ3BCLGdCQUFnQjtRQUNoQixtQkFBbUI7UUFDbkIsU0FBUztLQUNWLENBQUM7SUFDRixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsTUFBZ0IsQ0FBQyxFQUFFLENBQUM7UUFDbEQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDbkIsSUFBSSxFQUFFLGFBQWE7WUFDbkIsT0FBTyxFQUFFLHdDQUF3QyxTQUFTLENBQUMsTUFBTSxJQUFJO1NBQ3RFLENBQUMsQ0FBQztRQUNILE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsK0JBQStCLENBQzVELEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLEVBQ3hDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUNaLENBQUM7SUFDRixJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDMUIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDbkIsSUFBSSxFQUFFLGFBQWE7WUFDbkIsT0FBTyxFQUFFLHdDQUF3QztTQUNsRCxDQUFDLENBQUM7UUFDSCxPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDeEMsTUFBTSxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBRTFGLE1BQU0sU0FBUyxHQUFHLE1BQU0sT0FBTyxDQUFDLDJCQUEyQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2hFLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7QUFDakQsQ0FBQyJ9