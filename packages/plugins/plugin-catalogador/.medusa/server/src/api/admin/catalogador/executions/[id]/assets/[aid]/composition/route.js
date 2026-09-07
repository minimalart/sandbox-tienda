"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCompositionSchema = void 0;
exports.PATCH = PATCH;
const zod_1 = require("zod");
const catalogador_1 = require("../../../../../../../../modules/catalogador");
const config_1 = require("../../../../../../../../modules/catalogador/config");
const editable_lifestyle_1 = require("../../../../../../../../modules/catalogador/ai/editable-lifestyle");
const request_1 = require("../../../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../../../modules/catalogador/site-scope");
/**
 * PATCH /admin/catalogador/executions/:id/assets/:aid/composition (PRD §10).
 *
 * Actualiza ÚNICAMENTE `metadata.composition` de una propuesta lifestyle
 * editable. No genera archivos ni llama a IA (PRD §6.4). El backend aplica los
 * límites del PRD §14 (x/y ∈ [0,1], scale ∈ [MIN,MAX]). El render definitivo se
 * hace al aplicar (PRD §11), no acá.
 */
exports.UpdateCompositionSchema = zod_1.z.object({
    x: zod_1.z.number(),
    y: zod_1.z.number(),
    scale: zod_1.z.number(),
});
async function PATCH(req, res) {
    // El guard va sobre la EJECUCIÓN: la propuesta no tiene columna de tienda, cuelga
    // de `execution_product_id` y de ahí de la corrida.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    const aid = req.params.aid;
    const body = req.validatedBody;
    let proposal;
    try {
        proposal = await service.retrieveCatalogingAssetProposal(aid);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Propuesta de imagen no encontrada' });
        return;
    }
    /*
      El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA a la corrida del
      path, y va ANTES del 400 de `lifestyle_editable` de abajo a propósito: un 400 que
      dice "esta propuesta no admite composición" sobre una propuesta ajena ya delata
      que existe y de qué tipo es. La pertenencia se chequea antes que la forma.
  
      El salto es DOBLE porque `cataloging_asset_proposal` no tiene `execution_id`,
      sólo `execution_product_id` (ver `models/cataloging-asset-proposal.ts`): hay que
      pasar por el producto de la ejecución, que sí lo tiene. La lectura del producto
      es NUEVA acá —a diferencia de `assets/[aid]`, este handler no leía el producto en
      ningún camino—, y no hay atajo más corto en el servicio: no existe un
      `retrieve...ByExecution` ni una vista que junte los dos saltos.
  
      Sin esto, el daño no era sólo la mutación: el `logActivity` de abajo escribe
      `execution_id: id` con el id del PATH, así que editar la composición de una
      propuesta ajena dejaba el rastro anotado en MI corrida y ninguno en la corrida
      que de verdad cambió — la auditoría apuntando al lugar equivocado es peor que no
      tenerla.
  
      404 y no 403, igual que el guard: el status no tiene que delatar que esa
      propuesta existe en otra corrida.
    */
    const product = await service
        .retrieveCatalogingExecutionProduct(proposal.execution_product_id)
        .catch(() => null);
    if (product?.execution_id !== id) {
        res.status(404).json({ type: 'not_found', message: 'Propuesta de imagen no encontrada' });
        return;
    }
    if (proposal.operation_type !== 'lifestyle_editable') {
        res.status(400).json({
            type: 'invalid_data',
            message: 'Sólo las propuestas lifestyle editable admiten ajuste de composición.',
        });
        return;
    }
    const config = await (0, config_1.getCatalogadorConfig)(req.scope);
    const composition = (0, editable_lifestyle_1.clampComposition)({ x: body.x, y: body.y, scale: body.scale }, config.image_ai.editable_lifestyle_default_scale);
    const meta = (proposal.metadata ?? {});
    const nextMeta = { ...meta, composition };
    await service.updateCatalogingAssetProposals([{ id: aid, metadata: nextMeta }]);
    await service.logActivity({
        execution_id: id,
        execution_product_id: proposal.execution_product_id,
        type: 'catalogador.lifestyle_editable.edited',
        metadata: {
            asset_id: aid,
            initial_scale: meta.initial_composition?.scale ?? null,
            scale: composition.scale,
        },
    });
    const updated = await service.retrieveCatalogingAssetProposal(aid);
    res.status(200).json({ asset_proposal: updated });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9hc3NldHMvW2FpZF0vY29tcG9zaXRpb24vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBOEJBLHNCQStFQztBQTVHRCw2QkFBd0I7QUFDeEIsNkVBQWlGO0FBRWpGLCtFQUEwRjtBQUMxRiwwR0FHMkU7QUFFM0UsNEVBQWlGO0FBQ2pGLHdFQUE4RTtBQUM5RSx1RkFBeUc7QUFFekc7Ozs7Ozs7R0FPRztBQUNVLFFBQUEsdUJBQXVCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM5QyxDQUFDLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNiLENBQUMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFO0lBQ2IsS0FBSyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUU7Q0FDbEIsQ0FBQyxDQUFDO0FBSUksS0FBSyxVQUFVLEtBQUssQ0FBQyxHQUEwQyxFQUFFLEdBQW1CO0lBQ3pGLGtGQUFrRjtJQUNsRixvREFBb0Q7SUFDcEQsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSw0Q0FBK0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRXRILE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEyQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQ2hGLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBYSxDQUFDO0lBQ3JDLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxhQUF1QyxDQUFDO0lBRXpELElB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