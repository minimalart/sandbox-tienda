"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateExecutionSchema = exports.OperationInputSchema = void 0;
exports.GET = GET;
exports.POST = POST;
const zod_1 = require("zod");
const catalogador_1 = require("../../../../modules/catalogador");
const config_1 = require("../../../../modules/catalogador/config");
const request_1 = require("../../../../lib/multistore/request");
const _shared_1 = require("../_shared");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/catalogador/site-scope");
/** Operación elegida en el Paso 2 (campo de texto o de imagen). */
exports.OperationInputSchema = zod_1.z.object({
    type: zod_1.z.enum(['text_field', 'image_technical', 'image_ai']),
    field: zod_1.z.string().min(1),
    configuration: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.CreateExecutionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'El nombre es obligatorio'),
    product_ids: zod_1.z.array(zod_1.z.string()).min(1, 'Seleccioná al menos un producto'),
    operations: zod_1.z.array(exports.OperationInputSchema).min(1, 'Elegí al menos una mejora'),
    selection_definition: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/** GET /admin/catalogador/executions — lista paginada con filtros. */
async function GET(req, res) {
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filters = {};
    // Scopea el HISTORIAL, no el efecto: el producto enriquecido es compartido por toda
    // la instancia. Es para que el operador vea sus corridas sin el ruido de las demás.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE));
    if (typeof req.query.status === 'string' && req.query.status)
        filters.status = req.query.status;
    if (typeof req.query.created_by === 'string' && req.query.created_by) {
        filters.created_by = req.query.created_by;
    }
    if (typeof req.query.kind === 'string' && req.query.kind)
        filters.kind = req.query.kind;
    if (q)
        filters.name = { $ilike: `%${q}%` };
    const [executions, count] = await service.listAndCountCatalogingExecutions(filters, {
        skip: offset,
        take: limit,
        order: { created_at: 'DESC' },
    });
    res.status(200).json({ executions, count, offset, limit });
}
/**
 * POST /admin/catalogador/executions — crea una ejecución en borrador con la
 * selección exacta de productos (IDs) y las operaciones elegidas. NO genera
 * propuestas todavía (eso lo dispara /generate). PRD §10-§12.
 */
async function POST(req, res) {
    const input = req.validatedBody;
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const actorId = req.auth_context?.actor_id ?? null;
    // Con el siteId: el tope de productos por ejecución es configurable POR tienda,
    // y sin él se valida contra el global (ver nota en `_shared.ts`).
    const config = await (0, config_1.getCatalogadorConfig)(req.scope, await (0, _shared_1.siteOf)(req));
    const max = config.limits.max_products_per_execution;
    const productIds = Array.from(new Set(input.product_ids));
    if (productIds.length > max) {
        res.status(400).json({
            type: 'invalid_data',
            message: `La selección (${productIds.length}) supera el máximo por ejecución (${max}).`,
        });
        return;
    }
    const [execution] = await service.createCatalogingExecutions([
        {
            // La corrida queda atribuida a la tienda que la lanzó.
            ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE),
            name: input.name,
            status: 'draft',
            kind: 'enrichment',
            created_by: actorId,
            selection_definition: input.selection_definition ?? null,
            selection_count: productIds.length,
        },
    ]);
    if (!execution)
        throw new Error('No se pudo crear la ejecución');
    await service.createCatalogingExecutionProducts(productIds.map((product_id) => ({
        execution_id: execution.id,
        product_id,
        status: 'pending',
    })));
    await service.createCatalogingOperations(input.operations.map((op) => ({
        execution_id: execution.id,
        type: op.type,
        field: op.field,
        configuration: op.configuration ?? null,
        status: 'pending',
    })));
    await service.logActivity({
        execution_id: execution.id,
        type: 'created',
        actor_id: actorId,
        metadata: { product_count: productIds.length, operations: input.operations.length },
    });
    await service.recomputeProgress(execution.id);
    res.status(201).json({ execution });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBNEJBLGtCQTRCQztBQU9ELG9CQStEQztBQTdIRCw2QkFBd0I7QUFDeEIsaUVBQXFFO0FBRXJFLG1FQUE4RTtBQUU5RSxnRUFBcUU7QUFDckUsd0NBQW9DO0FBQ3BDLDREQUE0RTtBQUM1RSwyRUFBNkY7QUFFN0YsbUVBQW1FO0FBQ3RELFFBQUEsb0JBQW9CLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUMzQyxJQUFJLEVBQUUsT0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMzRCxLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDeEIsYUFBYSxFQUFFLE9BQUMsQ0FBQyxNQUFNLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRTtDQUM1RCxDQUFDLENBQUM7QUFFVSxRQUFBLHFCQUFxQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDNUMsSUFBSSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLDBCQUEwQixDQUFDO0lBQ25ELFdBQVcsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsaUNBQWlDLENBQUM7SUFDMUUsVUFBVSxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMsNEJBQW9CLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLDJCQUEyQixDQUFDO0lBQzdFLG9CQUFvQixFQUFFLE9B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