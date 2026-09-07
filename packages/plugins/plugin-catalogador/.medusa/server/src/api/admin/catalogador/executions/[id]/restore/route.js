"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const catalogador_1 = require("../../../../../../modules/catalogador");
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/catalogador/site-scope");
/**
 * POST /admin/catalogador/executions/:id/restore — crea una ejecución de tipo
 * Restauración (PRD §19.4/§20) que reescribe los valores previos (`pre`
 * snapshot) de los productos afectados. Nunca elimina el historial original. La
 * detección de conflictos (cambios posteriores) ocurre al aplicar, comparando
 * contra lo último que escribió la ejecución original (`post` snapshot).
 *
 * body: { product_ids?: string[] } — restaura sólo esos; si falta, toda la ejecución.
 */
async function POST(req, res) {
    // El mismo guard que el detalle, y de los más caros: la restauración nace
    // `ready_to_apply` con los snapshots `pre` de la corrida origen ya cargados como
    // `accepted_changes`. Sin guard, un id ajeno alcanza para armar —y después
    // aplicar— un rollback del catálogo de otra tienda.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    const body = (req.body ?? {});
    const actorId = req.auth_context?.actor_id ?? null;
    let source;
    try {
        source = await service.retrieveCatalogingExecution(id);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
        return;
    }
    if (!['applied', 'partially_applied'].includes(source.status)) {
        res.status(409).json({
            type: 'not_allowed',
            message: 'Sólo se puede restaurar una ejecución aplicada.',
        });
        return;
    }
    const preSnaps = await service.listCatalogingSnapshots({ execution_id: id, type: 'pre' }, { take: null });
    const postSnaps = await service.listCatalogingSnapshots({ execution_id: id, type: 'post' }, { take: null });
    const postByProduct = new Map(postSnaps.map((s) => [s.product_id, s.data]));
    const filter = (s) => !body.product_ids?.length || body.product_ids.includes(s.product_id);
    const targets = preSnaps.filter(filter);
    if (targets.length === 0) {
        res.status(409).json({ type: 'not_allowed', message: 'No hay snapshots previos para restaurar.' });
        return;
    }
    const [restoration] = await service.createCatalogingExecutions([
        {
            name: `Restauración de ${source.name}`,
            status: 'ready_to_apply',
            kind: 'restoration',
            created_by: actorId,
            // Sin esto la restauración nacía con `site_id NULL`, que con `empty: 'all'` es
            // visible desde TODAS las tiendas. Misma tienda activa que el create normal
            // (`executions/route.ts:85`), no la del origen.
            ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE),
            restored_from_execution_id: source.id,
            selection_count: targets.length,
        },
    ]);
    if (!restoration)
        throw new Error('No se pudo crear la restauración');
    await service.createCatalogingExecutionProducts(targets.map((snap) => ({
        execution_id: restoration.id,
        product_id: snap.product_id,
        status: 'accepted',
        // Escribimos de vuelta los valores previos.
        accepted_changes: (snap.data ?? {}),
        // Base de conflictos: lo último que dejó la ejecución original.
        current_snapshot: (postByProduct.get(snap.product_id) ?? {}),
    })));
    await service.logActivity({
        execution_id: restoration.id,
        type: 'restored',
        actor_id: actorId,
        metadata: { from: source.id, products: targets.length },
    });
    await service.recomputeProgress(restoration.id);
    res.status(201).json({ execution: restoration });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9yZXN0b3JlL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBaUJBLG9CQW9GQztBQXBHRCx1RUFBMkU7QUFHM0Usc0VBQTJFO0FBQzNFLGtFQUFzRjtBQUN0RixpRkFBbUc7QUFFbkc7Ozs7Ozs7O0dBUUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsMEVBQTBFO0lBQzFFLGlGQUFpRjtJQUNqRiwyRUFBMkU7SUFDM0Usb0RBQW9EO0lBQ3BELE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsNENBQStCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUV0SCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBMkIsZ0NBQWtCLENBQUMsQ0FBQztJQUNoRixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUErQixDQUFDO0lBQzVELE1BQU0sT0FBTyxHQUNWLEdBQTJELENBQUMsWUFBWSxFQUFFLFFBQVEsSUFBSSxJQUFJLENBQUM7SUFFOUYsSUFBSSxNQUFNLENBQUM7SUFDWCxJQUFJLENBQUM7UUFDSCxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsMkJBQTJCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFB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