"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intermediateRefs = intermediateRefs;
exports.resultRefs = resultRefs;
exports.cleanupProposalFiles = cleanupProposalFiles;
exports.cleanupExecutionFiles = cleanupExecutionFiles;
exports.cleanupUploadedFiles = cleanupUploadedFiles;
const utils_1 = require("@medusajs/framework/utils");
const index_1 = require("./index");
const asRecord = (value) => value && typeof value === 'object' ? value : {};
const str = (value) => (typeof value === 'string' && value ? value : null);
const layerRef = (value) => {
    const layer = asRecord(value);
    const url = str(layer.url);
    const fileId = str(layer.file_id);
    return url || fileId ? { fileId, url } : null;
};
/**
 * Archivos INTERMEDIOS de una propuesta: existen sólo para poder producir el
 * resultado y no se referencian nunca desde el producto.
 *
 * Hoy sólo el lifestyle editable tiene intermedios (fondo, capa de producto y
 * preview). El preview es el caso más claro de residuo del módulo: al aplicar,
 * `generated_asset_id` se sobrescribe con el render final y su URL desaparecía de
 * la base mientras el binario sobrevivía en el storage.
 */
function intermediateRefs(proposal) {
    if (proposal.operation_type !== 'lifestyle_editable')
        return [];
    const meta = asRecord(proposal.metadata);
    return [layerRef(meta.background), layerRef(meta.product_layer), layerRef(meta.preview)].filter((r) => r !== null);
}
/**
 * El archivo RESULTADO de una propuesta: lo que se adjuntaría al producto si se
 * acepta. Sólo se borra cuando la propuesta muere (rechazo, cancelación).
 */
function resultRefs(proposal) {
    const meta = asRecord(proposal.metadata);
    if (proposal.operation_type === 'lifestyle_editable') {
        // Tras aplicar, el resultado es el render final; antes, el preview (que ya
        // viaja en `intermediateRefs`, y de-duplicamos más abajo).
        const final = layerRef(meta.final_render);
        if (final)
            return [final];
        const generated = str(proposal.generated_asset_id);
        return generated ? [{ fileId: null, url: generated }] : [];
    }
    const url = str(proposal.generated_asset_id);
    const fileId = str(meta.file_id);
    return url || fileId ? [{ fileId, url }] : [];
}
/**
 * Borra un archivo sin poder romper la operación principal.
 *
 * Mismo criterio que `deleteFileBestEffort` de
 * `api/store/customers/me/avatar/route.ts`: ante un fallo de storage preferimos
 * dejar un huérfano antes que hacerle fallar al operador un rechazo o un apply que
 * en lo que importa ya se hizo.
 */
async function deleteRef(fileModule, mediaLibrary, ref) {
    let deleted = false;
    if (fileModule && ref.fileId) {
        try {
            await fileModule.deleteFiles(ref.fileId);
            deleted = true;
        }
        catch (error) {
            console.error('[catalogador-cleanup] No se pudo borrar el archivo:', ref.fileId, error);
        }
    }
    // La fila de la biblioteca se borra igual: si quedó sin `file_id` (propuestas
    // viejas), es además el único lugar de donde sacar el id del binario.
    if (mediaLibrary && ref.url) {
        try {
            const rows = await mediaLibrary.listMediaAssets({ url: ref.url });
            if (rows.length) {
                if (fileModule && !ref.fileId) {
                    for (const row of rows) {
                        const fileId = str(row.file_id);
                        if (!fileId)
                            continue;
                        try {
                            await fileModule.deleteFiles(fileId);
                            deleted = true;
                        }
                        catch (error) {
                            console.error('[catalogador-cleanup] No se pudo borrar el archivo:', fileId, error);
                        }
                    }
                }
                await mediaLibrary.deleteMediaAssets(rows.map((r) => r.id));
            }
        }
        catch (error) {
            console.error('[catalogador-cleanup] No se pudo limpiar la biblioteca de medios:', ref.url, error);
        }
    }
    return deleted;
}
const refKey = (ref) => `${ref.fileId ?? ''}|${ref.url ?? ''}`;
const safeResolve = (container, key) => {
    try {
        return container.resolve(key);
    }
    catch {
        return null;
    }
};
/**
 * Borra los archivos de las propuestas dadas.
 *
 * `mode`:
 *  - `'discard'` — la propuesta murió (rechazada, o su ejecución se canceló/borró):
 *    se van intermedios y resultado.
 *  - `'intermediates'` — la propuesta se APLICÓ: el resultado se queda (lo
 *    referencia el producto) y sólo se van los intermedios.
 *
 * `keepUrls` protege URLs que en este momento referencia el producto. Es la red
 * de seguridad contra borrar una imagen viva: sin ella, dos propuestas que
 * apuntaran al mismo archivo podrían dejar al producto con una URL muerta.
 */
async function cleanupProposalFiles(container, proposals, opts = { mode: 'discard' }) {
    if (!proposals.length)
        return { deleted: 0 };
    const fileModule = safeResolve(container, utils_1.Modules.FILE);
    const mediaLibrary = safeResolve(container, 'media_library');
    if (!fileModule && !mediaLibrary)
        return { deleted: 0 };
    const keep = new Set(opts.keepUrls ?? []);
    const refs = new Map();
    for (const proposal of proposals) {
        const own = opts.mode === 'discard'
            ? [...intermediateRefs(proposal), ...resultRefs(proposal)]
            : intermediateRefs(proposal);
        for (const ref of own) {
            if (ref.url && keep.has(ref.url))
                continue;
            refs.set(refKey(ref), ref);
        }
    }
    let deleted = 0;
    for (const ref of refs.values()) {
        if (await deleteRef(fileModule, mediaLibrary, ref))
            deleted++;
    }
    return { deleted };
}
/**
 * Barrido de TODOS los archivos generados por una ejecución que nunca se aplicaron.
 *
 * `cataloging_asset_proposal` no tiene `execution_id` —sólo `execution_product_id`
 * (ver `models/cataloging-asset-proposal.ts`)— así que hay que pasar por los
 * productos de la corrida. Las propuestas en `applied` se excluyen SIEMPRE: su
 * archivo lo referencia un producto vivo.
 *
 * `productIds` limita el barrido (lo usa la regeneración dirigida).
 * `deleteRows` borra además las filas: sin eso, regenerar dejaría en el tablero de
 * revisión propuestas apuntando a archivos que ya no existen.
 */
async function cleanupExecutionFiles(container, executionId, opts = {}) {
    const service = safeResolve(container, index_1.CATALOGADOR_MODULE);
    if (!service)
        return { deleted: 0, proposals: 0 };
    const productFilter = { execution_id: executionId };
    if (opts.productIds?.length)
        productFilter.id = opts.productIds;
    const products = await service.listCatalogingExecutionProducts(productFilter, {
        take: null,
    });
    if (!products.length)
        return { deleted: 0, proposals: 0 };
    const proposals = (await service.listCatalogingAssetProposals({ execution_product_id: products.map((p) => p.id) }, { take: null })).filter((a) => a.status !== 'applied');
    if (!proposals.length)
        return { deleted: 0, proposals: 0 };
    const { deleted } = await cleanupProposalFiles(container, proposals, { mode: 'discard' });
    if (opts.deleteRows) {
        await service.deleteCatalogingAssetProposals(proposals.map((a) => a.id)).catch((error) => {
            console.error('[catalogador-cleanup] No se pudieron borrar las propuestas:', error);
        });
    }
    return { deleted, proposals: proposals.length };
}
/**
 * Borra archivos recién subidos que ya no van a referenciarse.
 *
 * Para el camino de FALLO del pipeline: los tres assets del lifestyle editable se
 * suben ANTES de crear la propuesta, así que si el tercero falla —o falla el insert
 * de la propuesta— los dos primeros quedaban en el storage y el `catch` creaba una
 * propuesta en `error` con `generated_asset_id: null`, descartando sus URLs. Nadie
 * podía volver a encontrarlos.
 */
async function cleanupUploadedFiles(container, uploads) {
    const refs = uploads
        .filter((u) => Boolean(u))
        .map((u) => ({ fileId: str(u.id), url: str(u.url) }))
        .filter((r) => r.fileId || r.url);
    if (!refs.length)
        return { deleted: 0 };
    const fileModule = safeResolve(container, utils_1.Modules.FILE);
    const mediaLibrary = safeResolve(container, 'media_library');
    if (!fileModule && !mediaLibrary)
        return { deleted: 0 };
    const unique = new Map(refs.map((r) => [refKey(r), r]));
    let deleted = 0;
    for (const ref of unique.values()) {
        if (await deleteRef(fileModule, mediaLibrary, ref))
            deleted++;
    }
    return { deleted };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtY2xlYW51cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL2Fzc2V0LWNsZWFudXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF5REEsNENBTUM7QUFNRCxnQ0FhQztBQTZFRCxvREE2QkM7QUEwQkQsc0RBOEJDO0FBV0Qsb0RBb0JDO0FBblJELHFEQUFvRDtBQUVwRCxtQ0FBNkM7QUFrQzdDLE1BQU0sUUFBUSxHQUFHLENBQUMsS0FBYyxFQUEyQixFQUFFLENBQzNELEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFFLEtBQWlDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUUvRSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQWMsRUFBaUIsRUFBRSxDQUFDLENBQUMsT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUVuRyxNQUFNLFFBQVEsR0FBRyxDQUFDLEtBQWMsRUFBbUIsRUFBRTtJQUNuRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDOUIsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMzQixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2xDLE9BQU8sR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNoRCxDQUFDLENBQUM7QUFFRjs7Ozs7Ozs7R0FRRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLFFBQTJCO0lBQzFELElBQUksUUFBUSxDQUFDLGNBQWMsS0FBSyxvQkFBb0I7UUFBRSxPQUFPLEVBQUUs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