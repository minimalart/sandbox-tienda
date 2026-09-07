"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const catalogador_1 = require("../../../../../../modules/catalogador");
const config_1 = require("../../../../../../modules/catalogador/config");
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/catalogador/site-scope");
/**
 * POST /admin/catalogador/executions/:id/refloat — crea una NUEVA ejecución en
 * borrador basada en una histórica (PRD §20). Copia selección + operaciones. NO
 * reutiliza las propuestas anteriores (para eso está "duplicar"). El usuario
 * elige config histórica o vigente vía body.
 */
async function POST(req, res) {
    // El mismo guard que el detalle. Igual que duplicar: reflotar copia la selección y
    // las operaciones de la corrida origen, así que sin guard se lee la configuración
    // de otra tienda desde una corrida nueva y propia.
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
    const configuration_snapshot = body.use_current_config
        ? { config: await (0, config_1.getCatalogadorConfig)(req.scope), frozen_at: new Date().toISOString() }
        : source.configuration_snapshot ?? null;
    const [clone] = await service.createCatalogingExecutions([
        {
            name: `${source.name} (reflote)`,
            status: 'draft',
            kind: 'enrichment',
            created_by: actorId,
            // Sin esto el reflote nacía con `site_id NULL`, que con `empty: 'all'` no es
            // "de nadie" sino visible desde TODAS las tiendas. Misma tienda activa que el
            // create normal (`executions/route.ts:85`), no la del origen: heredar de una
            // ejecución global propagaría el NULL a cada reflote siguiente.
            ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE),
            selection_definition: source.selection_definition ?? null,
            selection_count: source.selection_count,
            configuration_snapshot,
            duplicated_from_execution_id: source.id,
        },
    ]);
    if (!clone)
        throw new Error('No se pudo reflotar la ejecución');
    const products = await service.listCatalogingExecutionProducts({ execution_id: id }, { take: null });
    if (products.length) {
        await service.createCatalogingExecutionProducts(products.map((p) => ({ execution_id: clone.id, product_id: p.product_id, status: 'pending' })));
    }
    const operations = await service.listCatalogingOperations({ execution_id: id });
    if (operations.length) {
        await service.createCatalogingOperations(operations.map((o) => ({
            execution_id: clone.id,
            type: o.type,
            field: o.field,
            configuration: o.configuration ?? null,
            status: 'pending',
        })));
    }
    await service.logActivity({
        execution_id: clone.id,
        type: 'refloated',
        actor_id: actorId,
        metadata: { from: source.id, use_current_config: Boolean(body.use_current_config) },
    });
    await service.recomputeProgress(clone.id);
    res.status(201).json({ execution: clone });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9yZWZsb2F0L3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBZUEsb0JBMkVDO0FBekZELHVFQUEyRTtBQUUzRSx5RUFBb0Y7QUFFcEYsc0VBQTJFO0FBQzNFLGtFQUFzRjtBQUN0RixpRkFBbUc7QUFFbkc7Ozs7O0dBS0c7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsbUZBQW1GO0lBQ25GLGtGQUFrRjtJQUNsRixtREFBbUQ7SUFDbkQsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSw0Q0FBK0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRXRILE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEyQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQ2hGLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQXFDLENBQUM7SUFDbEUsTUFBTSxPQUFPLEdBQ1YsR0FBMkQsQ0FBQyxZQUFZLEVBQUUsUUFBUSxJQUFJLElBQUksQ0FBQztJQUU5RixJQUFJLE1BQU0sQ0FBQztJQUNYLElBQUksQ0FBQztRQUNILE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVB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