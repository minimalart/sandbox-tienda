"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewProductSchema = void 0;
exports.POST = POST;
const zod_1 = require("zod");
const catalogador_1 = require("../../../../../../../modules/catalogador");
const asset_cleanup_1 = require("../../../../../../../modules/catalogador/asset-cleanup");
const config_1 = require("../../../../../../../modules/catalogador/config");
const lib_1 = require("./lib");
const request_1 = require("../../../../../../../lib/multistore/request");
const scope_1 = require("../../../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../../../modules/catalogador/site-scope");
exports.ReviewProductSchema = zod_1.z.object({
    action: zod_1.z.enum(['accept_all', 'reject_all', 'exclude', 'include', 'field']),
    /** Requerido para action='field'. */
    field: zod_1.z.string().optional(),
    decision: zod_1.z.enum(['accept', 'reject', 'edit', 'keep']).optional(),
    /** Nuevo valor para decision='edit'. */
    value: zod_1.z.unknown().optional(),
});
/**
 * POST /admin/catalogador/executions/:id/products/:pid
 *
 * Acciones de revisión por producto/campo (PRD §15.3/§15.4). No aplica cambios
 * al catálogo: sólo registra las DECISIONES del usuario sobre las propuestas.
 * La aplicación real la hace /apply (PRD §18.2).
 */
async function POST(req, res) {
    // El guard va sobre la EJECUCIÓN y no sobre `:pid`: `cataloging_execution_product`
    // no tiene columna de tienda propia, la hereda de la corrida. La pertenencia del
    // hijo al padre ya la valida el `product.execution_id !== executionId` de abajo,
    // así que las dos mitades juntas cierran el caso: el padre es mío y el hijo es de
    // ese padre.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.CATALOGING_EXECUTION_SITE_SCOPE, req.params.id);
    const service = req.scope.resolve(catalogador_1.CATALOGADOR_MODULE);
    const executionId = req.params.id;
    const pid = req.params.pid;
    const body = req.validatedBody;
    const actorId = req.auth_context?.actor_id ?? null;
    let product;
    try {
        product = await service.retrieveCatalogingExecutionProduct(pid);
    }
    catch {
        res.status(404).json({ type: 'not_found', message: 'Producto de la ejecución no encontrado' });
        return;
    }
    if (product.execution_id !== executionId) {
        res.status(404).json({ type: 'not_found', message: 'Producto no pertenece a la ejecución' });
        return;
    }
    const proposed = (product.proposed_changes ?? {});
    const accepted = { ...(product.accepted_changes ?? {}) };
    const rejected = { ...(product.rejected_changes ?? {}) };
    let status = product.status;
    let activityType = 'reviewed';
    // Gating por confianza (PRD §13/§22.5): con `require_review_low_confidence`,
    // los campos por debajo del umbral NO se auto-aceptan en "aceptar todo" y
    // quedan pendientes de una decisión explícita por campo. La confianza vive en
    // `proposed_changes[field].confidence` (el valor crudo se sigue descartando al
    // escribir en accepted_changes).
    const config = await (0, config_1.getCatalogadorConfig)(req.scope).catch(() => null);
    const requireReview = Boolean(config?.rules.require_review_low_confidence);
    const threshold = config?.rules.low_confidence_threshold ?? 0.7;
    const deferredLowConfidence = [];
    // Decisiones de TEXTO.
    switch (body.action) {
        case 'accept_all': {
            // Un campo con decisión explícita se saltea entero y NO cuenta como
            // diferido: ver `planAcceptAll` en ./lib para por qué importa.
            const plan = (0, lib_1.planAcceptAll)({ proposed, accepted, rejected, requireReview, threshold });
            Object.assign(accepted, plan.accept);
            for (const field of plan.unreject)
                delete rejected[field];
            deferredLowConfidence.push(...plan.deferred);
            break;
        }
        case 'reject_all':
            for (const field of Object.keys(proposed)) {
                rejected[field] = proposed[field];
                delete accepted[field];
            }
            break;
        case 'exclude':
        case 'include':
            break;
        case 'field': {
            if (!body.field) {
                res.status(400).json({ type: 'invalid_data', message: 'Falta "field".' });
                return;
            }
            const field = body.field;
            if (body.decision === 'accept') {
                accepted[field] = (0, lib_1.rawValue)(proposed[field]);
                delete rejected[field];
            }
            else if (body.decision === 'edit') {
                accepted[field] = body.value;
                delete rejected[field];
                activityType = 'edited';
            }
            else if (body.decision === 'reject' || body.decision === 'keep') {
                rejected[field] = proposed[field];
                delete accepted[field];
            }
            break;
        }
    }
    // Decisiones de IMÁGENES en acciones masivas: "aceptar todo" también elige
    // imágenes (una por tipo de operación; el resto se descarta), para que al
    // aplicar se adjunten. "rechazar todo"/"excluir" descartan todas.
    if (body.action === 'accept_all' || body.action === 'reject_all' || body.action === 'exclude') {
        const assetProps = await service.listCatalogingAssetProposals({ execution_product_id: pid }, { take: null });
        const pending = assetProps.filter((a) => a.status !== 'applied');
        if (body.action === 'accept_all') {
            // Técnicas (optimize, is_ai_generated=false): se aceptan TODAS (cada una
            // reemplaza una imagen distinta). IA: una por tipo de operación (las demás
            // variaciones son alternativas → se descartan).
            const seenAiOps = new Set();
            // Producto sin imagen: la importada real (import_external) y su recreación
            // IA (generate_missing) son EXCLUYENTES. En bulk se prefiere la imagen real
            // y se descarta la recreación (el usuario puede elegir la IA por producto).
            const hasImport = pending.some((a) => a.operation_type === 'import_external');
            const acc = [];
            const rej = [];
            for (const a of pending) {
                if (a.operation_type === 'import_external') {
                    acc.push(a.id);
                    continue;
                }
                if (!a.is_ai_generated) {
                    acc.push(a.id);
                    continue;
                }
                if (hasImport && a.operation_type === 'generate_missing') {
                    rej.push(a.id);
                    continue;
                }
                if (!seenAiOps.has(a.operation_type)) {
                    seenAiOps.add(a.operation_type);
                    acc.push(a.id);
                }
                else {
                    rej.push(a.id);
                }
            }
            if (acc.length)
                await service.updateCatalogingAssetProposals(acc.map((aid) => ({ id: aid, status: 'accepted' })));
            if (rej.length) {
                await service.updateCatalogingAssetProposals(rej.map((aid) => ({ id: aid, status: 'rejected' })));
                // Lo descartado por "aceptar todo" (variaciones sobrantes de la misma
                // operación) se borra. `keepUrls` protege las que quedaron aceptadas.
                const rejected = pending.filter((a) => rej.includes(a.id));
                const keepUrls = pending
                    .filter((a) => acc.includes(a.id))
                    .map((a) => a.generated_asset_id)
                    .filter((u) => Boolean(u));
                await (0, asset_cleanup_1.cleanupProposalFiles)(req.scope, rejected, { mode: 'discard', keepUrls });
            }
        }
        else {
            const toReject = pending.filter((a) => a.status !== 'rejected');
            if (toReject.length) {
                await service.updateCatalogingAssetProposals(toReject.map((a) => ({ id: a.id, status: 'rejected' })));
                await (0, asset_cleanup_1.cleanupProposalFiles)(req.scope, toReject, { mode: 'discard' });
            }
        }
    }
    // Estado final (considera texto Y imágenes aceptadas).
    if (body.action === 'exclude') {
        status = 'excluded';
    }
    else if (body.action === 'reject_all') {
        status = 'rejected';
    }
    else if (body.action === 'include') {
        status = Object.keys(proposed).length ? 'proposed' : 'pending';
    }
    else {
        const acceptedAssets = await service.listCatalogingAssetProposals({ execution_product_id: pid, status: 'accepted' }, { take: 1 });
        const hasAny = Object.keys(accepted).length > 0 || acceptedAssets.length > 0;
        if (hasAny)
            status = 'accepted';
        // Si "aceptar todo" difirió campos por baja confianza, el producto sigue
        // requiriendo revisión: queda 'proposed', no 'no_changes'.
        else if (deferredLowConfidence.length > 0)
            status = 'proposed';
        else
            status = body.action === 'accept_all' ? 'no_changes' : 'proposed';
    }
    const [updated] = await service.updateCatalogingExecutionProducts([
        { id: pid, status, accepted_changes: accepted, rejected_changes: rejected },
    ]);
    await service.logActivity({
        execution_id: executionId,
        execution_product_id: pid,
        type: activityType,
        actor_id: actorId,
        metadata: {
            action: body.action,
            field: body.field ?? null,
            decision: body.decision ?? null,
            // Los campos diferidos van también al timeline: si el usuario vuelve a
            // preguntar "por qué no se aceptó nada", la traza ya lo explica.
            ...(deferredLowConfidence.length
                ? {
                    deferred_low_confidence: deferredLowConfidence.length,
                    deferred_low_confidence_fields: deferredLowConfidence,
                    low_confidence_threshold: threshold,
                }
                : {}),
        },
    });
    // Recalcula progreso y ajusta el estado de la ejecución (parcialmente
    // revisada / lista para aplicar) sin forzar (PRD §8).
    await service.recomputeProgress(executionId);
    await maybeAdvanceExecution(service, executionId);
    // El gate de baja confianza difería campos sin dejar rastro en la respuesta:
    // el "aceptar todo" volvía 200 con `accepted_changes` vacío y desde la UI se
    // veía como si el botón no hiciera nada. Se devuelve `null` cuando no hubo
    // diferidos para que el consumidor pueda chequear presencia sin ambigüedad.
    res.status(200).json({
        product: updated,
        deferred_low_confidence: deferredLowConfidence.length
            ? { count: deferredLowConfidence.length, fields: deferredLowConfidence, threshold }
            : null,
    });
}
/** Ajusta el estado de la ejecución según cuántos productos quedan por revisar. */
async function maybeAdvanceExecution(service, executionId) {
    const execution = await service.retrieveCatalogingExecution(executionId);
    if (!['pending_review', 'partially_reviewed', 'ready_to_apply'].includes(execution.status)) {
        return;
    }
    const products = await service.listCatalogingExecutionProducts({ execution_id: executionId }, { take: null });
    const reviewable = products.filter((p) => !['excluded', 'applied'].includes(p.status));
    const pendingReview = reviewable.filter((p) => ['proposed', 'generating', 'pending'].includes(p.status));
    let next = execution.status;
    if (pendingReview.length === 0 && reviewable.length > 0)
        next = 'ready_to_apply';
    else if (pendingReview.length < reviewable.length)
        next = 'partially_reviewed';
    else
        next = 'pending_review';
    if (next !== execution.status) {
        await service.updateCatalogingExecutions([{ id: executionId, status: next }]);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2V4ZWN1dGlvbnMvW2lkXS9wcm9kdWN0cy9bcGlkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFnQ0Esb0JBNk1DO0FBNU9ELDZCQUF3QjtBQUN4QiwwRUFBOEU7QUFFOUUsMEZBQThGO0FBRTlGLDRFQUF1RjtBQUN2RiwrQkFBZ0Q7QUFFaEQseUVBQThFO0FBQzlFLHFFQUEyRTtBQUMzRSxvRkFBc0c7QUFFekYsUUFBQSxtQkFBbUIsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzFDLE1BQU0sRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzNFLHFDQUFxQztJQUNyQyxLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QixRQUFRLEVBQUUsT0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ2pFLHdDQUF3QztJQUN4QyxLQUFLLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUM5QixDQUFDLENBQUM7QUFLSDs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQStCLEVBQUUsR0FBbUI7SUFDN0UsbUZBQW1GO0lBQ25GLGlGQUFpRjtJQUNqRixpRkFBaUY7SUFDakYsa0ZBQWtGO0lBQ2xGLGFBQWE7SUFDYixNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLDRDQUErQixFQUFFLEdB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