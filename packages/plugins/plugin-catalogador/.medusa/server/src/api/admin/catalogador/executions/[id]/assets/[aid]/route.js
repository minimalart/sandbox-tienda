"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const catalogador_1 = require("../../../../../../../modules/catalogador");
const asset_cleanup_1 = require("../../../../../../../modules/catalogador/asset-cleanup");
const request_1 = require("../../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../../modules/catalogador/site-scope");
/**
 * POST /admin/catalogador/executions/:id/assets/:aid — acepta o rechaza una
 * propuesta de imagen (PRD §12.3: el usuario elige una variación y descarta las
 * demás). body: { decision: 'accept' | 'reject' }. Al aceptar una imagen IA,
 * las otras variaciones de la MISMA operación en ese producto se rechazan.
 */
async function POST(req, res) {
    // El guard va sobre la EJECUCIÓN: `cataloging_asset_proposal` no tiene columna de
    // tienda, cuelga de `execution_product_id` y de ahí de la corrida.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const executionId = req.params.id;
    const aid = req.params.aid;
    const body = (req.body ?? {});
    const decision = body.decision ?? 'accept';
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
      path. Sin esto el guard quedaba decorativo: `:aid` se resolvía por su PK y `:id`
      no se volvía a usar, así que una corrida propia con una propuesta ajena aceptaba
      —o rechazaba— la imagen de otra corrida.
  
      El salto es DOBLE porque el modelo no da uno solo: `cataloging_asset_proposal` no
      tiene `execution_id`, sólo `execution_product_id` (ver
      `models/cataloging-asset-proposal.ts`). Así que hay que pasar por el producto de
      la ejecución, que sí lo tiene, para llegar a la comparación que hace
      `products/[pid]`: `execution_id !== executionId → 404`.
  
      La lectura del producto NO es nueva: este handler ya la hacía, pero tarde y
      condicionada —dentro del `if (decision === 'accept')`, DESPUÉS de escribir el
      estado de la propuesta y envuelta en un catch best-effort—. Sirve como validación
      justamente porque se movió acá arriba: como guard tiene que correr antes de
      mutar, siempre, y su fallo tiene que cortar en vez de tragarse. El costo real es
      una consulta extra sólo en el camino 'reject'.
  
      La alternativa descartada era un descriptor `via_parent` encadenado para la
      propuesta: resuelve el eje de TIENDA en una llamada, pero seguiría aceptando una
      propuesta de otra corrida de la misma tienda, que es el cruce que rompe el
      tablero de revisión.
  
      404 y no 403, igual que el guard: el status no tiene que delatar que esa
      propuesta existe en otra corrida.
    */
    const product = await service
        .retrieveCatalogingExecutionProduct(proposal.execution_product_id)
        .catch(() => null);
    if (product?.execution_id !== executionId) {
        res.status(404).json({ type: 'not_found', message: 'Propuesta de imagen no encontrada' });
        return;
    }
    const nextStatus = decision === 'accept' ? 'accepted' : 'rejected';
    await service.updateCatalogingAssetProposals([{ id: aid, status: nextStatus }]);
    if (decision === 'reject') {
        // Rechazar deja de ser sólo un cambio de columna: el binario se va. Antes el
        // archivo quedaba en el storage para siempre, y la propuesta rechazada era la
        // única pista de que existía.
        await (0, asset_cleanup_1.cleanupProposalFiles)(req.scope, [proposal], { mode: 'discard' });
    }
    if (decision === 'accept') {
        // Exclusividad SÓLO para IA: las variaciones de la misma operación son
        // alternativas → elegir una descarta las demás. Las técnicas (optimize) NO
        // son excluyentes: cada una reemplaza una imagen distinta.
        if (proposal.is_ai_generated) {
            const siblings = await service.listCatalogingAssetProposals({ execution_product_id: proposal.execution_product_id, operation_type: proposal.operation_type }, { take: null });
            const toReject = siblings.filter((s) => s.id !== aid && s.status !== 'applied' && s.is_ai_generated);
            if (toReject.length) {
                await service.updateCatalogingAssetProposals(toReject.map((s) => ({ id: s.id, status: 'rejected' })));
                // Las variaciones descartadas son el residuo más voluminoso del módulo:
                // `variations: 2` por defecto significa que la mitad de lo generado por IA
                // nace para tirarse. `keepUrls` protege la elegida por si dos propuestas
                // llegaran a apuntar al mismo archivo.
                await (0, asset_cleanup_1.cleanupProposalFiles)(req.scope, toReject, {
                    mode: 'discard',
                    keepUrls: [proposal.generated_asset_id].filter((u) => Boolean(u)),
                });
            }
        }
        // Elegir una imagen marca el producto como aceptado (para que entre en la
        // aplicación aunque no se hayan aceptado campos de texto), salvo que ya esté
        // aplicado o excluido.
        //
        // Reusa el `product` que ya leyó la validación de pertenencia de arriba. El
        // try/catch se mantiene sólo alrededor de la ESCRITURA: el best-effort era para
        // no tumbar la decisión sobre la imagen si falla el arrastre del producto, no
        // para tolerar que el producto no se pueda leer — eso ahora es un 404 y corta.
        if (!['applied', 'excluded'].includes(product.status)) {
            try {
                await service.updateCatalogingExecutionProducts([
                    { id: proposal.execution_product_id, status: 'accepted' },
                ]);
            }
            catch {
                // best-effort
            }
        }
    }
    const updated = await service.retrieveCatalogingAssetProposal(aid);
    res.status(200).json({ asset_proposal: updated });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9hc3NldHMvW2FpZF0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFrQkEsb0JBNEdDO0FBN0hELDBFQUE4RTtBQUc5RSwwRkFBOEY7QUFFOUYseUVBQThFO0FBQzlFLHFFQUEyRTtBQUMzRSxvRkFBc0c7QUFJdEc7Ozs7O0dBS0c7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsa0ZBQWtGO0lBQ2xGLG1FQUFtRTtJQUNuRSxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDRDQUErQixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFdEgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQTJCLGdDQUFrQixDQUFDLENBQUM7SUFDaEYsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUM7SUFDNUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFhLENBQUM7SUFDckMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBdUMsQ0FBQztJQUNwRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQztJQUUzQyxJQUFJLFFBQVEsQ0FBQztJQUNiLElBQUksQ0FBQztRQUNILFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsR0FBRyxDQUFDLE1BQU0sQ0FBQyxH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