"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = catalogadorProcessJob;
const utils_1 = require("@medusajs/framework/utils");
const catalogador_1 = require("../modules/catalogador");
const config_1 = require("../modules/catalogador/config");
const openrouter_1 = require("../modules/catalogador/ai/openrouter");
const enrichment_1 = require("../modules/catalogador/ai/enrichment");
const prompts_1 = require("../modules/catalogador/ai/prompts");
const image_pipeline_1 = require("../modules/catalogador/ai/image-pipeline");
const apply_execution_1 = require("../workflows/catalogador/apply-execution");
/**
 * Job de procesamiento del Catalogador (PRD §14.1, §18.3): drena en segundo
 * plano las ejecuciones en `generating` (genera propuestas por producto) y en
 * `applying` (aplica cambios revisados). Tolera fallas por producto (éxito
 * parcial, PRD §32) y procesa en lotes acotados por tick para no colgar el loop.
 */
exports.config = {
    name: 'catalogador-process',
    schedule: process.env.CATALOGADOR_JOB_SCHEDULE || '*/1 * * * *',
};
async function catalogadorProcessJob(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const service = container.resolve(catalogador_1.CATALOGADOR_MODULE);
    await drainGenerating(container, service, logger);
    await drainApplying(container, service, logger);
}
async function drainGenerating(container, service, logger) {
    if (!(0, openrouter_1.isAiConfigured)())
        return;
    const generating = await service.listCatalogingExecutions({ status: 'generating' }, { take: 5 });
    for (const execution of generating) {
        try {
            const cfg = resolveFrozenConfig(execution.configuration_snapshot);
            // Fallback SIN snapshot congelado (ejecuciones creadas antes de que se guardara,
            // o con el snapshot corrupto): tiene que leer la config DE LA TIENDA de la
            // ejecución, no la de la instancia. `admin/catalogador/config` es `scoped` y
            // `cataloging_execution.site_id` existe (`CATALOGING_EXECUTION_SITE_SCOPE`), así
            // que sin pasarlo el operador de la tienda B elegía modelo, prompts y límites en
            // su pantalla y el job enriquecía sus productos con los de la instancia. Igual que
            // en `admin/banners/ai-*`: no falla, sale otro texto. `readSetting` cae sola a la
            // fila global si la tienda no guardó la suya, así que una ejecución vieja con
            // `site_id` null se comporta exactamente como antes.
            const config = cfg ?? (await (0, config_1.getCatalogadorConfig)(container, execution.site_id ?? null));
            const fields = await resolveTextFields(service, execution.id);
            // Se re-toman también los que quedaron en 'generating' de un tick previo que
            // se cortó a la mitad (si no, quedarían huérfanos y la ejecución "trabada").
            const pending = await service.listCatalogingExecutionProducts({ execution_id: execution.id, status: ['pending', 'generating'] }, { take: config.limits.max_concurrent_generations || 4, order: { created_at: 'ASC' } });
            if (pending.length === 0) {
                await service.setStatus(execution.id, 'pending_review');
                await service.setOperationsStatus(execution.id, 'done');
                await service.recomputeProgress(execution.id);
                await service.logActivity({ execution_id: execution.id, type: 'generation_completed' });
                continue;
            }
            // Operaciones de imagen elegidas (técnicas + IA).
            const imageOps = await resolveImageOps(service, execution.id);
            // Cargar taxonomía una vez por tick. Es NO fatal: si falla (p.ej. la query
            // de categorías), se sigue con taxonomía vacía y las categorías/tags quedan
            // sin resolver (con warning), en vez de dejar la ejecución trabada.
            let taxonomy = { categories: [], tags: [], categoryByNormalizedName: new Map(), tagByNormalizedValue: new Map() };
            if (fields.some((f) => f === 'categories' || f === 'tags')) {
                try {
                    taxonomy = await (0, enrichment_1.loadTaxonomy)(container);
                }
                catch (e) {
                    logger.warn(`[catalogador] loadTaxonomy falló (${e instanceof Error ? e.message : e}); sigo sin taxonomía.`);
                }
            }
            await service.updateCatalogingExecutionProducts(pending.map((p) => ({ id: p.id, status: 'generating' })));
            for (const p of pending) {
                // Ámbito de medición del costo IA de ESTE producto: cubre las llamadas de
                // texto y de imágenes a cualquier profundidad. Se acumula sobre lo que ya
                // tenía (cada reintento/regeneración se cobra aparte).
                const costScope = (0, openrouter_1.createAiUsageScope)();
                const costPatch = () => {
                    const merged = (0, openrouter_1.mergeAiUsage)(p.ai_usage ?? null, costScope.usage);
                    return { ai_cost_usd: merged.total_usd, ai_usage: merged };
                };
                try {
                    const warnings = [];
                    let proposedCount = 0;
                    // Imágenes reales encontradas en la web durante el paso de texto: se
                    // reutilizan en el paso de imágenes para no repetir la búsqueda web.
                    let imageCandidates;
                    const patch = {
                        id: p.id,
                        generation_attempts: (p.generation_attempts ?? 0) + 1,
                        errors: null,
                    };
                    // 1) Enriquecimiento textual (si hay campos de texto).
                    if (fields.length) {
                        const result = await costScope.run(() => (0, enrichment_1.generateForProduct)({
                            container,
                            productId: p.product_id,
                            fields,
                            config,
                            taxonomy,
                            attempt: (p.generation_attempts ?? 0) + 1,
                        }));
                        proposedCount += Object.keys(result.proposed_changes).length;
                        warnings.push(...result.warnings);
                        patch.proposed_changes = result.proposed_changes;
                        patch.current_snapshot = result.current_snapshot;
                        patch.product_version_reference = result.product_version_reference;
                        patch.external_context_summary = result.external_context_summary;
                        imageCandidates = result.external_image_candidates;
                    }
                    // 2) Imágenes (técnicas + IA) → crean asset proposals.
                    if (imageOps.length) {
                        const imgRes = await costScope.run(() => (0, image_pipeline_1.processImagesForProduct)({
                            container,
                            executionId: execution.id,
                            executionProductId: p.id,
                            productId: p.product_id,
                            config,
                            operations: imageOps,
                            externalImageCandidates: imageCandidates,
                        }));
                        proposedCount += imgRes.created;
                        warnings.push(...imgRes.warnings);
                    }
                    patch.status = proposedCount > 0 ? 'proposed' : 'no_changes';
                    patch.warnings = (warnings.length ? warnings : null);
                    Object.assign(patch, costPatch());
                    await service.updateCatalogingExecutionProducts([patch]);
                }
                catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    logger.warn(`[catalogador] generación falló producto ${p.product_id}: ${message}`);
                    await service.updateCatalogingExecutionProducts([
                        {
                            id: p.id,
                            status: 'error',
                            errors: [message],
                            generation_attempts: (p.generation_attempts ?? 0) + 1,
                            // Lo consumido antes del error ya se cobró: se persiste igual.
                            ...costPatch(),
                        },
                    ]);
                }
            }
            await service.recomputeProgress(execution.id);
            // ¿Quedan pendientes/en curso? Si no, cerrar generación.
            const stillPending = await service.listCatalogingExecutionProducts({ execution_id: execution.id, status: ['pending', 'generating'] }, { take: 1 });
            if (stillPending.length === 0) {
                await service.setStatus(execution.id, 'pending_review');
                await service.setOperationsStatus(execution.id, 'done');
                await service.logActivity({ execution_id: execution.id, type: 'generation_completed' });
            }
        }
        catch (e) {
            // Falla a nivel ejecución (antes del loop por producto): se marca la
            // ejecución como 'error' con el detalle, en vez de reintentar en silencio
            // cada minuto y quedar "trabada" en generating.
            const message = e instanceof Error ? e.message : String(e);
            logger.error(`[catalogador] ejecución ${execution.id} falló al generar: ${message}`);
            await service
                .updateCatalogingExecutions([{ id: execution.id, status: 'error', error_summary: { message } }])
                .catch(() => undefined);
            await service.logActivity({ execution_id: execution.id, type: 'error', metadata: { phase: 'generate', message } });
            // La corrida murió: las operaciones no se quedan diciendo `running`.
            await service.setOperationsStatus(execution.id, 'error');
        }
    }
}
async function drainApplying(container, service, logger) {
    const applying = await service.listCatalogingExecutions({ status: 'applying' }, { take: 3 });
    for (const execution of applying) {
        try {
            await (0, apply_execution_1.applyExecution)(container, execution.id);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error(`[catalogador] aplicación falló ejecución ${execution.id}: ${message}`);
            await service.updateCatalogingExecutions([
                { id: execution.id, status: 'error', error_summary: { message } },
            ]);
        }
    }
}
function resolveFrozenConfig(snapshot) {
    if (snapshot && typeof snapshot === 'object' && 'config' in snapshot) {
        return (0, config_1.mergeCatalogadorConfig)(snapshot.config);
    }
    return null;
}
/** Deriva los campos de texto elegidos a partir de las operaciones de la ejecución. */
async function resolveTextFields(service, executionId) {
    const ops = await service.listCatalogingOperations({ execution_id: executionId, type: 'text_field' });
    const fields = ops.map((o) => o.field).filter((f) => prompts_1.TEXT_FIELDS.includes(f));
    return [...new Set(fields)];
}
/** Operaciones de imagen (técnicas + IA) de la ejecución. */
async function resolveImageOps(service, executionId) {
    const ops = await service.listCatalogingOperations({ execution_id: executionId });
    return ops
        .filter((o) => o.type === 'image_technical' || o.type === 'image_ai')
        .map((o) => ({ type: o.type, field: o.field }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZ2Fkb3ItcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9qb2JzL2NhdGFsb2dhZG9yLXByb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBMkJBLHdDQU1DO0FBaENELHFEQUFzRTtBQUN0RSx3REFBNEQ7QUFFNUQsMERBQXFIO0FBQ3JILHFFQUs4QztBQUM5QyxxRUFBd0Y7QUFDeEYsK0RBQWdGO0FBQ2hGLDZFQUFtRjtBQUNuRiw4RUFBMEU7QUFFMUU7Ozs7O0dBS0c7QUFDVSxRQUFBLE1BQU0sR0FBRztJQUNwQixJQUFJLEVBQUUscUJBQXFCO0lBQzNCLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixJQUFJLGFBQWE7Q0FDaEUsQ0FBQztBQUVhLEtBQUssVUFBVSxxQkFBcUIsQ0FBQyxTQUEwQjtJQUM1RSxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFTLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNFLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQTJCLGdDQUFrQixDQUFDLENBQUM7SUFFaEYsTUFBTSxlQUFlLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNsRCxNQUFNLGFBQWEsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFRCxLQUFLLFVBQVUsZUFBZSxDQUM1QixTQUEwQixFQUMxQixPQUFpQyxFQUNqQyxNQUFjO0lBRWQsSUFBSSxDQUFDLElBQUEsMkJBQWMsR0FBRTtRQUFFLE9BQU87SUFFOUIsTUFBTSxVQUFVLEdBQUcsTUFBTSxPQUFPLENBQUMsd0JBQXdCLENBQUMsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNqRyxLQUFLLE1BQU0sU0FBUyxJQUFJ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