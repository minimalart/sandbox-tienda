"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyExecution = applyExecution;
const utils_1 = require("@medusajs/framework/utils");
const catalogador_1 = require("../../modules/catalogador");
const config_1 = require("../../modules/catalogador/config");
const asset_cleanup_1 = require("../../modules/catalogador/asset-cleanup");
const apply_status_1 = require("../../modules/catalogador/apply-status");
const images_1 = require("../../modules/catalogador/ai/images");
const editable_lifestyle_1 = require("../../modules/catalogador/ai/editable-lifestyle");
/**
 * Aplicación de cambios revisados (PRD §18). Es idempotente y de éxito parcial:
 * NO llama a IA/scraping/barcode (PRD §18.2), sólo escribe lo aceptado por el
 * usuario. Antes de escribir guarda un snapshot `pre`; después, un snapshot
 * `post` (PRD §19). Detecta cambios concurrentes comparando los valores
 * actuales contra `current_snapshot` capturado al generar (PRD §18.4): si un
 * campo cambió, NO se sobrescribe y se marca como conflicto.
 *
 * Se expone como función (la invoca el job catalogador-process) para poder
 * reanudarse por tick sin estado en memoria.
 */
const FREEFORM_TO_COLUMN = {
    subtitle: 'subtitle',
    description: 'description',
};
const METADATA_FIELDS = ['meta_title', 'meta_description', 'keywords', 'alt_text'];
async function applyExecution(container, executionId) {
    const service = container.resolve(catalogador_1.CATALOGADOR_MODULE);
    const productModule = container.resolve(utils_1.Modules.PRODUCT);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const execution = await service.retrieveCatalogingExecution(executionId);
    if (execution.status !== 'applying')
        return;
    // Config para el render final del lifestyle editable (PRD §11). Se carga una
    // vez por ejecución; es best-effort para el resto de la aplicación.
    //
    // Con el site de la EJECUCIÓN, igual que `jobs/catalogador-process.ts`: sin él
    // `readSetting` lee la fila global y el render final sale con otra calidad y
    // otro peso objetivo que el resto de las imágenes de la misma corrida.
    const siteId = execution.site_id ?? null;
    const config = await (0, config_1.getCatalogadorConfig)(container, siteId).catch(() => null);
    // Productos aplicables: aceptados (texto) o con imágenes aceptadas.
    const allProducts = await service.listCatalogingExecutionProducts({ execution_id: executionId }, { take: null, order: { created_at: 'ASC' } });
    const products = allProducts.filter((p) => !['excluded', 'applied'].includes(p.status));
    let applied = 0;
    let failed = 0;
    for (const p of products) {
        // `apply_failed` también entra: sus `accepted_changes` siguen ahí y el fallo
        // pudo ser transitorio (una descarga, el File Module) o resoluble (todo era
        // conflicto y el operador ya lo miró). Leer sólo `accepted` dejaba a esos
        // productos fuera de TODO re-apply: el comentario de `renderEditableFinal`
        // prometía "se puede reintentar (PRD §14)" y en la práctica no se reintentaba
        // nunca — la única salida era volver a aceptar un campo a mano para que la
        // ruta de revisión los devolviera a `accepted`.
        const accepted = apply_status_1.RETRYABLE_PRODUCT_STATUSES.includes(p.status)
            ? (p.accepted_changes ?? {})
            : {};
        // Imágenes aceptadas para este producto (se adjuntan como secundarias).
        const acceptedAssets = await service.listCatalogingAssetProposals({ execution_product_id: p.id, status: 'accepted' }, { take: null });
        if (Object.keys(accepted).length === 0 && acceptedAssets.length === 0)
            continue;
        try {
            // Releer estado actual del producto (para conflictos + snapshot pre).
            const { data } = await query.graph({
                entity: 'product',
                fields: [
                    'id',
                    'subtitle',
                    'description',
                    'metadata',
                    'thumbnail',
                    'images.id',
                    'images.url',
                    'categories.id',
                    'tags.id',
                ],
                filters: { id: p.product_id },
            });
            const current = data[0];
            if (!current)
                throw new Error('Producto no encontrado al aplicar');
            const prevSnapshot = (p.current_snapshot ?? {});
            const conflicts = [];
            const updatePayload = {};
            const metadataPatch = {};
            const preData = {};
            for (const [field, rawAccepted] of Object.entries(accepted)) {
                // Defensa: si por datos viejos el valor aceptado quedó como el objeto de
                // propuesta { value, ... } en vez del valor crudo, se desenvuelve.
                const value = rawAccepted && typeof rawAccepted === 'object' && 'value' in rawAccepted
                    ? rawAccepted.value
                    : rawAccepted;
                const currentVal = currentValueForField(current, field);
                preData[field] = currentVal ?? null;
                // Conflicto: el valor actual difiere del que había al generar (alguien
                // lo cambió en el medio). No se sobrescribe (PRD §18.4).
                if (field in prevSnapshot && !valuesEqual(prevSnapshot[field], currentVal)) {
                    conflicts.push(field);
                    continue;
                }
                if (FREEFORM_TO_COLUMN[field]) {
                    updatePayload[FREEFORM_TO_COLUMN[field]] = value;
                }
                else if (METADATA_FIELDS.includes(field)) {
                    metadataPatch[field] = value;
                }
                else if (field === 'categories') {
                    const ids = Array.isArray(value) ? value : [];
                    updatePayload.categories = ids.map((id) => ({ id }));
                }
                else if (field === 'tags') {
                    const ids = Array.isArray(value) ? value : [];
                    updatePayload.tags = ids.map((id) => ({ id }));
                }
            }
            // Imágenes aceptadas:
            //  - Optimizaciones TÉCNICAS (is_ai_generated=false): REEMPLAZAN en su lugar
            //    la imagen original (misma posición/id), sin sumar copias.
            //  - Generadas por IA (is_ai_generated=true): se AGREGAN como secundarias.
            // El original se conserva en la biblioteca de medios (no se borra).
            const existingImages = (current.images ?? []).filter((i) => i.url);
            const existingUrls = new Set(existingImages.map((i) => i.url));
            const replaceMap = new Map();
            const additions = [];
            // Renders finales del lifestyle editable (assetId → asset final) para
            // actualizar la propuesta tras aplicar (PRD §11).
            const editableFinals = new Map();
            for (const a of acceptedAssets) {
                // Lifestyle editable: el render definitivo se hace ACÁ, con la última
                // composición guardada (PRD §11). Si falla, lanza → el producto queda
                // apply_failed y se puede reintentar (PRD §14).
                if (a.operation_type === 'lifestyle_editable') {
                    const finalAsset = await renderEditableFinal(container, a, config, siteId);
                    editableFinals.set(a.id, finalAsset);
                    additions.push(finalAsset.url);
                    continue;
                }
                const gen = a.generated_asset_id;
                if (!gen)
                    continue;
                // `import_external` (imagen real traída de la web) NO reemplaza nada: el
                // producto no tenía imagen, se AGREGA como nueva. El resto de las no-IA
                // (optimizaciones técnicas) reemplazan su imagen de origen.
                if (a.is_ai_generated || a.operation_type === 'import_external')
                    additions.push(gen);
                else if (a.source_asset_id)
                    replaceMap.set(a.source_asset_id, gen);
            }
            const newAdditions = [...new Set(additions)].filter((u) => !existingUrls.has(u));
            if (replaceMap.size > 0 || newAdditions.length > 0) {
                preData.images = existingImages.map((i) => i.url);
                const rebuilt = existingImages.map((i) => {
                    const replaced = replaceMap.get(i.url);
                    const url = replaced ?? i.url;
                    return i.id ? { id: i.id, url } : { url };
                });
                updatePayload.images = [...rebuilt, ...newAdditions.map((url) => ({ url }))];
                const currentThumb = current.thumbnail;
                if (currentThumb && replaceMap.has(currentThumb)) {
                    updatePayload.thumbnail = replaceMap.get(currentThumb);
                }
            }
            const appliedFields = Object.keys(updatePayload).length + Object.keys(metadataPatch).length;
            const nothingToApply = Object.keys(updatePayload).length === 0 && Object.keys(metadataPatch).length === 0;
            if (nothingToApply) {
                // Todo era conflicto → no se aplica, se marca para decisión del usuario.
                await service.updateCatalogingExecutionProducts([
                    {
                        id: p.id,
                        status: 'apply_failed',
                        warnings: conflicts.map((f) => `Conflicto en "${f}"`),
                    },
                ]);
                failed++;
                continue;
            }
            void appliedFields;
            // Snapshot PRE (sólo campos afectados).
            await service.createCatalogingSnapshots([
                { execution_id: executionId, product_id: p.product_id, type: 'pre', data: preData },
            ]);
            if (Object.keys(metadataPatch).length) {
                const currentMeta = current.metadata ?? {};
                updatePayload.metadata = { ...currentMeta, ...metadataPatch };
            }
            await productModule.updateProducts(p.product_id, updatePayload);
            // Marca las imágenes aceptadas como aplicadas. Para el lifestyle editable,
            // además apunta `generated_asset_id` al render final y guarda `final_render`
            // en metadata (PRD §11 pasos 9-10).
            if (acceptedAssets.length) {
                await service.updateCatalogingAssetProposals(acceptedAssets.map((a) => {
                    const patch = { id: a.id, status: 'applied' };
                    const finalAsset = editableFinals.get(a.id);
                    if (finalAsset) {
                        patch.generated_asset_id = finalAsset.url;
                        const meta = (a.metadata ?? {});
                        patch.metadata = { ...meta, final_render: { url: finalAsset.url, file_id: finalAsset.file_id } };
                    }
                    return patch;
                }));
                for (const a of acceptedAssets) {
                    if (editableFinals.has(a.id)) {
                        await service.logActivity({
                            execution_id: executionId,
                            execution_product_id: p.id,
                            type: 'catalogador.lifestyle_editable.applied',
                            metadata: { asset_id: a.id },
                        });
                    }
                }
                // Intermedios del lifestyle editable: con el render final ya subido y
                // referenciado por el producto, el fondo, la capa de producto y el preview
                // no vuelven a usarse. El preview era el residuo más difícil de rastrear:
                // el patch de arriba acaba de sobrescribir su `generated_asset_id`, así que
                // sin este barrido su archivo quedaba huérfano y sin ninguna referencia.
                const appliedEditables = acceptedAssets.filter((a) => editableFinals.has(a.id));
                if (appliedEditables.length) {
                    await (0, asset_cleanup_1.cleanupProposalFiles)(container, appliedEditables, {
                        mode: 'intermediates',
                        keepUrls: [...editableFinals.values()].map((f) => f.url),
                    });
                }
            }
            // Propuestas NO aceptadas de un producto ya aplicado: su archivo está subido y
            // nunca va a referenciarse. Se descartan acá y no al rechazar porque un
            // producto puede aplicarse con propuestas que quedaron sin decidir.
            const staleAssets = (await service.listCatalogingAssetProposals({ execution_product_id: p.id }, { take: null })).filter((a) => ['proposed', 'pending', 'rejected'].includes(a.status));
            if (staleAssets.length) {
                // Todo lo que el producto referencia es intocable: las imágenes que ya
                // tenía, las que acaba de recibir y el thumbnail. Se arma con las tres
                // fuentes y no sólo con `updatePayload.images` porque ese campo queda
                // `undefined` cuando la aplicación no tocó imágenes, y un `keepUrls` vacío
                // ahí dejaría al producto con una URL muerta.
                const liveUrls = new Set(existingImages.map((i) => i.url));
                for (const img of updatePayload.images ?? []) {
                    if (img.url)
                        liveUrls.add(img.url);
                }
                const thumb = updatePayload.thumbnail ?? current.thumbnail;
                if (thumb)
                    liveUrls.add(thumb);
                await (0, asset_cleanup_1.cleanupProposalFiles)(container, staleAssets, { mode: 'discard', keepUrls: liveUrls });
            }
            // Snapshot POST.
            const postData = {};
            for (const field of Object.keys(accepted)) {
                if (conflicts.includes(field))
                    continue;
                postData[field] = accepted[field];
            }
            await service.createCatalogingSnapshots([
                { execution_id: executionId, product_id: p.product_id, type: 'post', data: postData },
            ]);
            await service.updateCatalogingExecutionProducts([
                {
                    id: p.id,
                    status: 'applied',
                    warnings: (conflicts.length
                        ? conflicts.map((f) => `Conflicto no aplicado en "${f}"`)
                        : null),
                },
            ]);
            await service.logActivity({
                execution_id: executionId,
                execution_product_id: p.id,
                type: 'applied',
                metadata: { fields: Object.keys(accepted), conflicts },
            });
            applied++;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await service.updateCatalogingExecutionProducts([
                { id: p.id, status: 'apply_failed', errors: [message] },
            ]);
            await service.logActivity({
                execution_id: executionId,
                execution_product_id: p.id,
                type: 'apply_failed',
                metadata: { message },
            });
            failed++;
        }
    }
    // Trabajo pendiente medido DESPUÉS del loop, sobre los statuses ya escritos:
    // medirlo antes contaba como pendientes a los `accepted` que el propio loop
    // estaba por convertir en `applied`, y no veía a los que acababan de quedar
    // `apply_failed`. La regla vive en `apply-status.ts` (puro y testeado): este
    // workflow no se puede correr sin container, así que acá adentro la decisión no
    // era testeable.
    const afterProducts = await service.listCatalogingExecutionProducts({ execution_id: executionId }, { take: null });
    const unfinished = afterProducts.filter((p) => apply_status_1.UNFINISHED_PRODUCT_STATUSES.includes(p.status)).length;
    const finalStatus = (0, apply_status_1.resolveApplyFinalStatus)({ applied, failed, unfinished });
    await service.setStatus(executionId, finalStatus);
    await service.updateCatalogingExecutions([
        {
            id: executionId,
            // `unfinished` explícito: sin él, un `applied + failed < total` era la
            // única pista de que la corrida había dejado productos atrás, y había que
            // deducirla restando.
            summary: { applied, failed, unfinished, total: products.length },
        },
    ]);
    await service.recomputeProgress(executionId);
    // Si esto era una restauración que se aplicó (aunque sea parcialmente), la
    // ejecución de origen queda marcada como "restored" (PRD §8).
    if (execution.kind === 'restoration' &&
        execution.restored_from_execution_id &&
        finalStatus !== 'error') {
        await service.updateCatalogingExecutions([
            { id: execution.restored_from_execution_id, status: 'restored' },
        ]);
        await service.logActivity({
            execution_id: execution.restored_from_execution_id,
            type: 'restored',
            metadata: { by_execution: executionId },
        });
    }
}
/**
 * Render final del lifestyle editable (PRD §11): descarga fondo + capa de
 * producto, compone con la última composición guardada, sube el WebP al File
 * Module y lo registra en la Media Library. Lanza si falta un asset o falla la
 * descarga/subida (el producto quedará `apply_failed` y podrá reintentarse).
 */
async function renderEditableFinal(container, proposal, config, siteId) {
    const cfg = config ?? (await (0, config_1.getCatalogadorConfig)(container, siteId));
    const meta = (proposal.metadata ?? {});
    const bgUrl = meta.background?.url;
    const productUrl = meta.product_layer?.url;
    if (!bgUrl || !productUrl) {
        throw new Error('La propuesta lifestyle editable no tiene assets para renderizar.');
    }
    const [bg, product] = await Promise.all([(0, images_1.fetchImageBytes)(bgUrl), (0, images_1.fetchImageBytes)(productUrl)]);
    if (!bg)
        throw new Error('No se pudo descargar el fondo lifestyle.');
    if (!product)
        throw new Error('No se pudo descargar la capa del producto.');
    const composition = (0, editable_lifestyle_1.clampComposition)(meta.composition ?? {}, cfg.image_ai.editable_lifestyle_default_scale);
    const rendered = await (0, editable_lifestyle_1.renderEditableLifestyle)({ background: bg, product, composition, config: cfg });
    const fileModule = container.resolve(utils_1.Modules.FILE);
    const token = Math.random().toString(36).slice(2, 10);
    const filename = `catalogador/lifestyle-editable-${proposal.id}-${token}.webp`;
    const [file] = await fileModule.createFiles([
        { filename, mimeType: rendered.mimeType, content: rendered.buffer.toString('base64'), access: 'public' },
    ]);
    if (!file)
        throw new Error('No se pudo subir el render final del lifestyle editable.');
    try {
        const mediaLibrary = container.resolve('media_library');
        await mediaLibrary
            .registerAsset({
            url: file.url,
            file_id: file.id,
            filename,
            mime_type: rendered.mimeType,
            size: rendered.bytes,
            source: 'catalogador',
            metadata: { ai_generated: true, lifestyle_editable: true },
        })
            .catch(() => undefined);
    }
    catch {
        // media library es opcional
    }
    return { url: file.url, file_id: file.id };
}
function currentValueForField(product, field) {
    switch (field) {
        case 'subtitle':
            return product.subtitle ?? null;
        case 'description':
            return product.description ?? null;
        case 'categories':
            return (product.categories ?? []).map((c) => c.id).filter(Boolean);
        case 'tags':
            return (product.tags ?? []).map((t) => t.id).filter(Boolean);
        case 'meta_title':
        case 'meta_description':
        case 'keywords':
        case 'alt_text':
            return (product.metadata ?? {})[field] ?? null;
        default:
            return null;
    }
}
function valuesEqual(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
        const sa = [...a].map(String).sort();
        const sb = [...b].map(String).sort();
        return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
    }
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHktZXhlY3V0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9jYXRhbG9nYWRvci9hcHBseS1leGVjdXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFvQ0Esd0NBd1VDO0FBNVdELHFEQUErRTtBQUUvRSwyREFBK0Q7QUFFL0QsNkRBQWdHO0FBQ2hHLDJFQUErRTtBQUMvRSx5RUFJZ0Q7QUFDaEQsZ0VBQXNFO0FBQ3RFLHdGQUl5RDtBQUV6RDs7Ozs7Ozs7OztHQVVHO0FBRUgsTUFBTSxrQkFBa0IsR0FBK0M7SUFDckUsUUFBUSxFQUFFLFVBQVU7SUFDcEIsV0FBVyxFQUFFLGFBQWE7Q0FDM0IsQ0FBQztBQUNGLE1BQU0sZUFBZSxHQUFHLENBQUMsWUFBWSxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUU1RSxLQUFLLFVBQVUsY0FBYyxDQUFDLFNBQTBCLEVBQUUsV0FBbUI7SUFDbEYsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBMkIsZ0NBQWtCLENBQUMsQ0FBQztJQUNoRixNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6RCxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRWpFLE1BQU0sU0FBUyxHQUFHLE1BQU0sT0FBTyxDQUFDLDJCQUEyQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3pFLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxVQUFVO1FBQUUsT0FBTztJQUU1Qyw2RUFBNkU7SUFDN0Usb0VBQW9FO0lBQ3BFLEVBQUU7SUFDRiwrRUFBK0U7SUFDL0UsNkVBQTZFO0lBQzdFLHVFQUF1RTtJQUN2RSxNQUFNLE1BQU0sR0FBSSxTQUFTLENBQUMsT0FBeUIsSUFBSSxJQUFJLENBQUM7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