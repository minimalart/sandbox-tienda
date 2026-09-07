"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateExecutionSchema = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const utils_1 = require("@medusajs/framework/utils");
const zod_1 = require("zod");
const catalogador_1 = require("../../../../../modules/catalogador");
const asset_cleanup_1 = require("../../../../../modules/catalogador/asset-cleanup");
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/catalogador/site-scope");
exports.UpdateExecutionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
});
/** GET /admin/catalogador/executions/:id — detalle con productos/operaciones/actividad. */
async function GET(req, res) {
    // Todos los handlers: cancelar o reanudar la corrida de otra tienda le corta un
    // proceso que no lanzó.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    let execution;
    try {
        execution = await service.retrieveCatalogingExecution(id);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
        return;
    }
    const products = await service.listCatalogingExecutionProducts({ execution_id: id }, { take: null, order: { created_at: 'ASC' } });
    const operations = await service.listCatalogingOperations({ execution_id: id });
    const activity = await service.listCatalogingActivities({ execution_id: id }, { take: 200, order: { created_at: 'DESC' } });
    const assetProposals = products.length
        ? await service.listCatalogingAssetProposals({ execution_product_id: products.map((p) => p.id) }, { take: null })
        : [];
    // Adjunta título/thumbnail de cada producto para la tabla de validación (la UI
    // muestra el producto, no el id crudo).
    let productsEnriched = products;
    if (products.length) {
        const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
        const { data } = await query.graph({
            entity: 'product',
            fields: ['id', 'title', 'thumbnail', 'handle'],
            filters: { id: products.map((p) => p.product_id) },
        });
        const info = new Map(data.map((p) => [
            p.id,
            p,
        ]));
        productsEnriched = products.map((p) => ({
            ...p,
            product_title: info.get(p.product_id)?.title ?? null,
            product_thumbnail: info.get(p.product_id)?.thumbnail ?? null,
            product_handle: info.get(p.product_id)?.handle ?? null,
        }));
    }
    res
        .status(200)
        .json({ execution, products: productsEnriched, operations, activity, asset_proposals: assetProposals });
}
/** PATCH /admin/catalogador/executions/:id — renombrar (u otros metadatos livianos). */
async function POST(req, res) {
    // Todos los handlers: cancelar o reanudar la corrida de otra tienda le corta un
    // proceso que no lanzó.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    const body = req.validatedBody;
    try {
        await service.retrieveCatalogingExecution(id);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
        return;
    }
    const [execution] = await service.updateCatalogingExecutions([{ id, ...body }]);
    res.status(200).json({ execution });
}
/** DELETE /admin/catalogador/executions/:id — sólo borradores/canceladas/error (PRD §9.5). */
async function DELETE(req, res) {
    // Todos los handlers: cancelar o reanudar la corrida de otra tienda le corta un
    // proceso que no lanzó.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    let execution;
    try {
        execution = await service.retrieveCatalogingExecution(id);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
        return;
    }
    if (!service.isDeletable(execution.status)) {
        res.status(409).json({
            type: 'not_allowed',
            message: 'Una ejecución aplicada o en proceso no se puede eliminar.',
        });
        return;
    }
    // Antes de borrar la fila: `deleteCatalogingExecutions` no cascadea (los hijos
    // cuelgan por FK de texto, no por relación MikroORM), así que sin este barrido los
    // archivos quedaban en el storage sin nada en la base que los nombrara.
    // `isDeletable` sólo admite draft/cancelled/error, así que nada está aplicado.
    await (0, asset_cleanup_1.cleanupExecutionFiles)(req.scope, id, { deleteRows: true });
    await service.deleteCatalogingExecutions([id]);
    res.status(200).json({ id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFpQkEsa0JBMkRDO0FBR0Qsb0JBa0JDO0FBR0Qsd0JBK0JDO0FBbElELHFEQUFzRTtBQUN0RSw2QkFBd0I7QUFDeEIsb0VBQXdFO0FBRXhFLG9GQUF5RjtBQUd6RixtRUFBd0U7QUFDeEUsK0RBQXFFO0FBQ3JFLDhFQUFnRztBQUVuRixRQUFBLHFCQUFxQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDNUMsSUFBSSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFO0NBQ25DLENBQUMsQ0FBQztBQUVILDJGQUEyRjtBQUNwRixLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsZ0ZBQWdGO0lBQ2hGLHdCQUF3QjtJQUN4QixNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDRDQUErQixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFdEgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQTJCLGdDQUFrQixDQUFDLENBQUM7SUFDaEYsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUM7SUFFbkMsSUFBSSxTQUFTLENBQUM7SUFDZCxJQUFJLENBQUM7UUFDSCxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsMkJBQTJCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLEdBQUcsQ0FBQyxNQUFNLENBQUMs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