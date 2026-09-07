"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateExecutionSchema = void 0;
exports.POST = POST;
const zod_1 = require("zod");
const catalogador_1 = require("../../../../../../modules/catalogador");
const config_1 = require("../../../../../../modules/catalogador/config");
const openrouter_1 = require("../../../../../../modules/catalogador/ai/openrouter");
const request_1 = require("../../../../../../lib/multistore/request");
const _shared_1 = require("../../../_shared");
const asset_cleanup_1 = require("../../../../../../modules/catalogador/asset-cleanup");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/catalogador/site-scope");
exports.GenerateExecutionSchema = zod_1.z.object({
    /** Si se pasa, sólo (re)genera estos productos (regeneración dirigida). */
    product_ids: zod_1.z.array(zod_1.z.string()).optional(),
    /** Regenerar sólo los fallidos. */
    only_failed: zod_1.z.boolean().optional(),
});
/**
 * POST /admin/catalogador/executions/:id/generate
 *
 * Marca la ejecución como `generating` y congela la config efectiva usada
 * (PRD §14.1). El procesamiento real corre en segundo plano (job
 * catalogador-process) para que el usuario pueda abandonar la pantalla
 * (PRD §14.1). No genera nada de forma síncrona.
 */
async function POST(req, res) {
    // El mismo guard que el detalle, y ANTES del chequeo de config: generar sobre la
    // corrida de otra tienda le pisa el estado a `generating`, le resetea productos a
    // `pending` y le quema crédito de IA. Va primero para que un id ajeno conteste 404
    // y no un 503 que ya confirmaría que la ruta llegó a mirar la fila.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    const body = req.validatedBody;
    const actorId = req.auth_context?.actor_id ?? null;
    if (!(0, openrouter_1.isAiConfigured)()) {
        res.status(503).json({
            type: 'not_allowed',
            message: 'OPENROUTER_API_KEY no está configurada en el backend.',
        });
        return;
    }
    let execution;
    try {
        execution = await service.retrieveCatalogingExecution(id);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
        return;
    }
    const allowed = ['draft', 'pending_review', 'partially_reviewed', 'error'];
    if (!allowed.includes(execution.status)) {
        res.status(409).json({
            type: 'not_allowed',
            message: `No se puede generar desde el estado "${execution.status}".`,
        });
        return;
    }
    // Congela la config efectiva usada por esta ejecución (incluye versión de
    // prompts). No se toca si ya estaba congelada por una corrida previa.
    // Con el siteId, y NO sin él: `readSetting` sin tienda va derecho a la fila
    // global, así que congelar sin site descarta lo que el operador guardó para SU
    // tienda en /config y corre la ejecución con los defaults.
    const config = await (0, config_1.getCatalogadorConfig)(req.scope, await (0, _shared_1.siteOf)(req));
    const configuration_snapshot = execution.configuration_snapshot ?? { config, frozen_at: new Date().toISOString() };
    // Marca los productos objetivo como pendientes de (re)generar.
    const targetFilter = { execution_id: id };
    if (body.product_ids?.length)
        targetFilter.product_id = body.product_ids;
    else if (body.only_failed)
        targetFilter.status = 'error';
    const targets = await service.listCatalogingExecutionProducts(targetFilter, {
        take: null,
    });
    if (targets.length) {
        const toRegenerate = targets.filter((p) => p.status !== 'excluded');
        // Limpiar ANTES de re-encolar: regenerar no reemplazaba las propuestas viejas,
        // creaba propuestas nuevas y volvía a subir el set completo de archivos. Cada
        // reintento multiplicaba el residuo, y el tablero de revisión acumulaba
        // propuestas de todas las corridas. Las ya aplicadas nunca se tocan.
        if (toRegenerate.length) {
            await (0, asset_cleanup_1.cleanupExecutionFiles)(req.scope, id, {
                productIds: toRegenerate.map((p) => p.id),
                deleteRows: true,
            });
        }
        await service.updateCatalogingExecutionProducts(toRegenerate.map((p) => ({ id: p.id, status: 'pending' })));
    }
    await service.updateCatalogingExecutions([{ id, configuration_snapshot }]);
    await service.setStatus(id, 'generating');
    // Las operaciones acompañan el ciclo de la corrida: sin esto quedaban en
    // `pending` para siempre y el panel mentía sobre lo que había corrido.
    await service.setOperationsStatus(id, 'running');
    await service.logActivity({
        execution_id: id,
        type: 'generation_started',
        actor_id: actorId,
        metadata: { targeted: Boolean(body.product_ids?.length), only_failed: Boolean(body.only_failed) },
    });
    const execAfter = await service.retrieveCatalogingExecution(id);
    res.status(202).json({ execution: execAfter, queued: targets.length });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9nZW5lcmF0ZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUE4QkEsb0JBeUZDO0FBdEhELDZCQUF3QjtBQUN4Qix1RUFBMkU7QUFFM0UseUVBQW9GO0FBQ3BGLG9GQUFxRjtBQUVyRixzRUFBMkU7QUFDM0UsOENBQTBDO0FBQzFDLHVGQUE0RjtBQUM1RixrRUFBd0U7QUFDeEUsaUZBQW1HO0FBRXRGLFFBQUEsdUJBQXVCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM5QywyRUFBMkU7SUFDM0UsV0FBVyxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQzNDLG1DQUFtQztJQUNuQyxXQUFXLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNwQyxDQUFDLENBQUM7QUFJSDs7Ozs7OztHQU9HO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FDeEIsR0FBaUMsRUFDakMsR0FBbUI7SUFFbkIsaUZBQWlGO0lBQ2pGLGtGQUFrRjtJQUNsRixtRkFBbUY7SUFDbkYsb0VBQW9FO0lBQ3BFLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsNENBQStCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUV0SCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBMkIsZ0NBQWtCLENBQUMsQ0FBQztJQUNoRixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsYUFBOEIsQ0FBQztJQUNoRCxNQUFNLE9BQU8sR0FDVixHQUEyRCxDQUFDLFlBQVksRUFBRSxRQUFRLElBQUksSUFBSSxDQUFDO0lBRTlGLElBQUksQ0FBQyxJQUFBLDJCQUFjLEdBQUUsRUFBRSxDQUFDO1FBQ3RCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ25CLElBQUksRUFBRSxhQUFhO1lBQ25CLE9BQU8sRUFBRSx1REFBdUQ7U0FDakUsQ0FBQyxDQUFDO1FBQ0gsT0FBTztJQUNULENBQUM7SUFFRCxJQUFJLFNBQVMsQ0FBQztJQUNkLElBQUksQ0FBQztRQUNILFNBQVMsR0FBRyxNQUFNLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDaEYsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxvQkFBb0IsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMzRSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsTUFBZ0IsQ0FBQyxFQUFFLENBQUM7UUFDbEQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDbkIsSUFBSSxFQUFFLGFBQWE7WUFDbkIsT0FBTyxFQUFFLHdDQUF3QyxTQUFTLENBQUMsTUFBTSxJQUFJO1NBQ3RFLENBQUMsQ0FBQztRQUNILE9BQU87SUFDVCxDQUFDO0lBRUQsMEVBQTBFO0lBQzFFLHNFQUFzRTtJQUN0RSw0RUFBNEU7SUFDNUUsK0VBQStFO0lBQy9FLDJEQUEyRDtJQUMzRCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsNkJBQW9CLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEsZ0JBQU0sRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sc0JBQXNCLEdBQzFCLFNBQVMsQ0FBQyxzQkFBc0IsSUFBSSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO0lBRXRGLCtEQUErRDtJQUMvRCxNQUFNLFlBQVksR0FBNEIsRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDbkUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLE1BQU07UUFBRSxZQUFZLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7U0FDcEUsSUFBSSxJQUFJLENBQUMsV0FBVztRQUFFLFlBQVksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDO0lBRXpELE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLCtCQUErQixDQUFDLFlBQVksRUFBRTtRQUMxRSxJQUFJLEVBQUUsSUFBeUI7S0FDaEMsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbkIsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxVQUFVLENBQUMsQ0FBQztRQUNwRSwrRUFBK0U7UUFDL0UsOEVBQThFO1FBQzlFLHdFQUF3RTtRQUN4RSxxRUFBcUU7UUFDckUsSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDeEIsTUFBTSxJQUFBLHFDQUFxQixFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFO2dCQUN6QyxVQUFVLEVBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDekMsVUFBVSxFQUFFLElBQUk7YUFDakIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNELE1BQU0sT0FBTyxDQUFDLGlDQUFpQyxDQUM3QyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLFNBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQ3BFLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzRSxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzFDLHlFQUF5RTtJQUN6RSx1RUFBdUU7SUFDdkUsTUFBTSxPQUFPLENBQUMsbUJBQW1CLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2pELE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUN4QixZQUFZLEVBQUUsRUFBRTtRQUNoQixJQUFJLEVBQUUsb0JBQW9CO1FBQzFCLFFBQVEsRUFBRSxPQUFPO1FBQ2pCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRTtLQUNsRyxDQUFDLENBQUM7SUFFSCxNQUFNLFNBQVMsR0FBRyxNQUFNLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNoRSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ3pFLENBQUMifQ==