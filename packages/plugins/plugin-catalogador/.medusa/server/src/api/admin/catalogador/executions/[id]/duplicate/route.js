"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const catalogador_1 = require("../../../../../../modules/catalogador");
const request_1 = require("../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../modules/catalogador/site-scope");
/**
 * POST /admin/catalogador/executions/:id/duplicate — clona una ejecución como
 * nuevo BORRADOR, copiando selección + operaciones + config y TAMBIÉN las
 * propuestas ya generadas (a diferencia de "reflotar", que no las reutiliza —
 * PRD §20).
 */
async function POST(req, res) {
    // El mismo guard que el detalle. Acá no alcanza con que "sólo lee y clona": el
    // clon se lleva `selection_definition` y `configuration_snapshot` de la corrida
    // origen, así que sin guard esto es un EXPORT de la configuración de otra tienda
    // disfrazado de duplicado.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const id = req.params.id;
    const actorId = req.auth_context?.actor_id ?? null;
    let source;
    try {
        source = await service.retrieveCatalogingExecution(id);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
        return;
    }
    const [clone] = await service.createCatalogingExecutions([
        {
            name: `${source.name} (copia)`,
            status: 'draft',
            kind: 'enrichment',
            created_by: actorId,
            selection_definition: source.selection_definition ?? null,
            selection_count: source.selection_count,
            configuration_snapshot: source.configuration_snapshot ?? null,
            duplicated_from_execution_id: source.id,
            /*
              Sin esto el clon nacía con `site_id NULL`, y como el descriptor tiene
              `empty: 'all'` eso NO significa "de nadie": significa visible desde TODAS
              las tiendas. Duplicar una ejecución de Norte la volvía global, sin error y
              sin que el listado de Norte —que ve los globales— lo delatara.
      
              Hereda de la TIENDA ACTIVA y no de `source.site_id`, igual que el create
              normal (`executions/route.ts:85`). Heredar del origen propagaría el `NULL`
              de una ejecución global: cada copia de una copia seguiría siendo global, y
              el agujero se reproduciría solo.
            */
            ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE),
        },
    ]);
    if (!clone)
        throw new Error('No se pudo duplicar la ejecución');
    const products = await service.listCatalogingExecutionProducts({ execution_id: id }, { take: null });
    if (products.length) {
        await service.createCatalogingExecutionProducts(products.map((p) => ({
            execution_id: clone.id,
            product_id: p.product_id,
            status: p.status === 'excluded' ? 'excluded' : p.proposed_changes ? 'proposed' : 'pending',
            proposed_changes: p.proposed_changes ?? null,
            current_snapshot: p.current_snapshot ?? null,
            product_version_reference: p.product_version_reference ?? null,
            external_context_summary: p.external_context_summary ?? null,
        })));
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
        type: 'duplicated',
        actor_id: actorId,
        metadata: { from: source.id },
    });
    await service.recomputeProgress(clone.id);
    res.status(201).json({ execution: clone });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9kdXBsaWNhdGUvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFjQSxvQkFzRkM7QUFuR0QsdUVBQTJFO0FBRzNFLHNFQUEyRTtBQUMzRSxrRUFBc0Y7QUFDdEYsaUZBQW1HO0FBRW5HOzs7OztHQUtHO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLCtFQUErRTtJQUMvRSxnRkFBZ0Y7SUFDaEYsaUZBQWlGO0lBQ2pGLDJCQUEyQjtJQUMzQixNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDRDQUErQixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFdEgsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQTJCLGdDQUFrQixDQUFDLENBQUM7SUFDaEYsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUM7SUFDbkMsTUFBTSxPQUFPLEdBQ1YsR0FBMkQsQ0FBQyxZQUFZLEVBQUUsUUFBUSxJQUFJLElBQUksQ0FBQztJQUU5RixJQUFJLE1BQU0sQ0FBQztJQUNYLElBQUksQ0FBQztRQUNILE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDaEYsT0FBTztJQUNU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