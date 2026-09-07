"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImagesForProduct = processImagesForProduct;
const utils_1 = require("@medusajs/framework/utils");
const index_1 = require("../index");
const images_1 = require("./images");
const editable_lifestyle_1 = require("./editable-lifestyle");
const asset_cleanup_1 = require("../asset-cleanup");
const external_1 = require("./external");
const barcode_1 = require("./barcode");
const TECHNICAL_OPS = new Set(['to_webp', 'compress', 'resize', 'normalize']);
const AI_OPS = new Set(['recreate', 'lifestyle', 'lifestyle_editable', 'background', 'generate_missing', 'variation']);
/**
 * Procesa las operaciones de imagen de un producto (PRD §12.2/§12.3) y crea
 * `cataloging_asset_proposal` para revisión. Sube los resultados al File module
 * y los registra en la biblioteca de medios. Conserva SIEMPRE los originales y
 * nunca reemplaza la imagen principal (eso se decide al aplicar, sólo si el
 * usuario acepta y la regla lo permite).
 */
async function processImagesForProduct(opts) {
    const { container, config } = opts;
    const service = container.resolve(index_1.CATALOGADOR_MODULE);
    const fileModule = container.resolve(utils_1.Modules.FILE);
    const mediaLibrary = safeResolve(container, 'media_library');
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const warnings = [];
    const { data } = await query.graph({
        entity: 'product',
        fields: [
            'id',
            'title',
            'thumbnail',
            'images.url',
            'variants.sku',
            'variants.barcode',
            'variants.ean',
            'variants.upc',
            'variants.metadata',
        ],
        filters: { id: opts.productId },
    });
    const product = data[0];
    if (!product)
        return { created: 0, warnings: ['Producto no encontrado'] };
    const variants = product.variants ?? [];
    const images = (product.images ?? []).map((i) => i.url).filter(Boolean);
    const mainUrl = product.thumbnail || images[0] || null;
    const title = product.title || 'producto';
    const imageOps = opts.operations.filter((o) => o.type === 'image_technical' || o.type === 'image_ai');
    const techFields = imageOps.filter((o) => o.type === 'image_technical' && TECHNICAL_OPS.has(o.field)).map((o) => o.field);
    const aiOps = imageOps.filter((o) => o.type === 'image_ai' && AI_OPS.has(o.field));
    let created = 0;
    // --- Optimización TÉCNICA: UNA versión optimizada POR IMAGEN que REEMPLAZA la
    //     original (no suma copias). Cada técnica elegida es una etapa REAL y
    //     componible de `processTechnical` (resize → normalize → encode → compresión
    //     a `max_kb`), así que marcar sólo una hace sólo esa. Se procesan todas las
    //     imágenes del producto (hasta un tope, que se avisa). El original se conserva
    //     en la biblioteca de medios.
    const MAX_OPTIMIZE = 10;
    const optimizeCandidates = [...new Set([mainUrl, ...images].filter((u) => Boolean(u)))];
    const imagesToOptimize = optimizeCandidates.slice(0, MAX_OPTIMIZE);
    // El tope se avisa: truncar en silencio se lee como "se procesó todo".
    if (optimizeCandidates.length > MAX_OPTIMIZE) {
        warnings.push(`El producto tiene ${optimizeCandidates.length} imágenes: se optimizaron las primeras ${MAX_OPTIMIZE}.`);
    }
    if (techFields.length && imagesToOptimize.length) {
        for (const url of imagesToOptimize) {
            try {
                const src = await (0, images_1.fetchImageBytes)(url);
                if (!src) {
                    warnings.push(`No se pudo descargar la imagen para optimizar`);
                    continue;
                }
                const before = await (0, images_1.inspectImage)(src);
                // `processTechnical` compone las etapas elegidas. Antes acá había un ternario
                // `normalize ? ... : ...` que hacía que marcar sólo "Redimensionar", sólo
                // "Comprimir" o sólo "Convertir a WebP" diera el MISMO resultado, y que
                // "Comprimir" no aplicara `max_kb` en cuanto "Normalizar" estaba tildado.
                const result = await (0, images_1.processTechnical)(src, {
                    ops: techFields,
                    quality: config.image_technical.webp_quality,
                    maxKb: config.image_technical.max_kb,
                    maxDimension: config.image_technical.max_dimension,
                });
                const asset = await uploadResult(fileModule, mediaLibrary, title, result, false);
                if (result.targetKbMissed) {
                    warnings.push(`Una imagen quedó en ${Math.round(result.bytes / 1024)}KB, por encima del objetivo de ` +
                        `${config.image_technical.max_kb}KB (ya en la calidad mínima).`);
                }
                await service.createCatalogingAssetProposals([
                    {
                        execution_product_id: opts.executionProductId,
                        source_asset_id: url,
                        generated_asset_id: asset?.url ?? null,
                        operation_type: 'optimize',
                        status: 'proposed',
                        is_ai_generated: false,
                        metadata: {
                            ops: techFields,
                            replaces: url,
                            file_id: asset?.id ?? null,
                            format: result.format,
                            quality: result.quality,
                            target_kb_missed: result.targetKbMissed,
                            before: { bytes: before.bytes, width: before.width, height: before.height },
                            after: { bytes: result.bytes, width: result.width, height: result.height },
                        },
                    },
                ]);
                created++;
            }
            catch (e) {
                warnings.push(`Optimización de imagen: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
    // --- Generación IA: imágenes NUEVAS (se agregan como secundarias). Usa TODAS
    //     las imágenes del producto como referencia. NUNCA se genera una imagen
    //     con IA sin una referencia real: si el producto no tiene foto propia, se
    //     intenta con una imagen real encontrada en la web; si tampoco hay, se
    //     salta y se marca para carga manual (no se alucina desde el título).
    if (aiOps.length) {
        const MAX_REF_IMAGES = 6;
        const refUrls = [...new Set([mainUrl, ...images].filter((u) => Boolean(u)))].slice(0, MAX_REF_IMAGES);
        const ownRefs = [];
        for (const u of refUrls) {
            const bytes = await (0, images_1.fetchImageBytes)(u);
            if (bytes)
                ownRefs.push((0, images_1.toDataUrl)(bytes, 'image/jpeg'));
        }
        // Candidatas de imagen web: las trae el paso de texto (opts). Para
        // ejecuciones SÓLO de imagen (sin campos de texto) el paso de texto no
        // corrió, así que se recolectan acá una vez (no hay duplicación de llamadas).
        let externalCandidates = opts.externalImageCandidates;
        if (externalCandidates === undefined &&
            ownRefs.length === 0 &&
            aiOps.some((o) => o.field === 'generate_missing')) {
            const barcode = (0, barcode_1.pickProductBarcode)(variants);
            const ext = await (0, external_1.gatherExternalContext)({ config, barcode, title });
            externalCandidates = ext?.image_candidates ?? [];
            if (ext?.warnings?.length)
                warnings.push(...ext.warnings);
        }
        // Imágenes reales de la web (Tavily): se descargan y validan por tamaño
        // (descarta thumbnails) sólo si alguna operación las necesita. Memoizado.
        // Si NINGUNA alcanza `min_dimension`, la más grande (piso 200px) se usa
        // igual como referencia para IA (`belowMinDim`): alcanza para recrear,
        // pero no para importarla tal cual al catálogo.
        const MIN_FALLBACK_DIM = 200;
        let externalRefsCache = null;
        const getExternalRefs = async () => {
            if (externalRefsCache)
                return externalRefsCache;
            const candidates = (externalCandidates ?? []).slice(0, MAX_REF_IMAGES);
            const dataUrls = [];
            let firstBytes = null;
            let firstUrl = null;
            let fallback = null;
            const minDim = config.image_technical.min_dimension || 0;
            for (const url of candidates) {
                const bytes = await (0, images_1.fetchImageBytes)(url);
                if (!bytes)
                    continue;
                let side;
                try {
                    const meta = await (0, images_1.inspectImage)(bytes);
                    side = Math.min(meta.width, meta.height);
                }
                catch {
                    continue;
                }
                if (minDim && side < minDim) {
                    if (side >= MIN_FALLBACK_DIM && (!fallback || side > fallback.side))
                        fallback = { bytes, url, side };
                    continue;
                }
                if (!firstBytes) {
                    firstBytes = bytes;
                    firstUrl = url;
                }
                dataUrls.push((0, images_1.toDataUrl)(bytes, 'image/jpeg'));
                if (dataUrls.length >= 3)
                    break;
            }
            let belowMinDim = false;
            if (!firstBytes && fallback) {
                belowMinDim = true;
                firstBytes = fallback.bytes;
                firstUrl = fallback.url;
                dataUrls.push((0, images_1.toDataUrl)(fallback.bytes, 'image/jpeg'));
            }
            externalRefsCache = { dataUrls, firstBytes, firstUrl, belowMinDim, candidateCount: candidates.length };
            return externalRefsCache;
        };
        for (const op of aiOps) {
            try {
                // Rama específica del lifestyle editable (PRD §7.2): NO se refactoriza el
                // pipeline; se ejecuta una rama aparte que produce UNA propuesta con
                // fondo + capa de producto + composición inicial (no variaciones).
                if (op.field === 'lifestyle_editable') {
                    // Fuera del try: si algo falla DESPUÉS de subir, el catch necesita saber
                    // qué llegó a subirse para poder borrarlo. Los tres uploads ocurren antes
                    // de crear la propuesta, así que sin esto un fallo parcial dejaba archivos
                    // que ninguna fila de la base volvía a nombrar.
                    const uploaded = [];
                    try {
                        const references = await referenceBytesList(mainUrl, images);
                        if (references.length === 0) {
                            warnings.push('"lifestyle_editable" requiere una imagen de referencia');
                            continue;
                        }
                        const built = await (0, editable_lifestyle_1.buildEditableLifestyle)({ config, productTitle: title, references });
                        const productAsset = await uploadResult(fileModule, mediaLibrary, title, built.product, true);
                        uploaded.push(productAsset);
                        const backgroundAsset = await uploadResult(fileModule, mediaLibrary, title, built.background, true);
                        uploaded.push(backgroundAsset);
                        const previewAsset = await uploadResult(fileModule, mediaLibrary, title, built.preview, true);
                        uploaded.push(previewAsset);
                        if (!productAsset || !backgroundAsset || !previewAsset) {
                            throw new Error('No se pudieron subir los assets del lifestyle editable.');
                        }
                        const metadata = {
                            version: 1,
                            background: { url: backgroundAsset.url, file_id: backgroundAsset.id },
                            product_layer: { url: productAsset.url, file_id: productAsset.id, source_url: mainUrl ?? '' },
                            // El preview en su PROPIO campo: al aplicar, `generated_asset_id` se
                            // sobrescribe con el render final y esta referencia es la única que
                            // queda para poder borrar el intermedio.
                            preview: { url: previewAsset.url, file_id: previewAsset.id },
                            composition: built.composition,
                            initial_composition: built.composition,
                        };
                        await service.createCatalogingAssetProposals([
                            {
                                execution_product_id: opts.executionProductId,
                                source_asset_id: mainUrl,
                                generated_asset_id: previewAsset.url,
                                operation_type: 'lifestyle_editable',
                                status: 'proposed',
                                is_ai_generated: true,
                                generation_provider: 'openrouter',
                                generation_model: config.image_ai.model,
                                metadata: metadata,
                            },
                        ]);
                        created++;
                        if (opts.executionId) {
                            await service.logActivity({
                                execution_id: opts.executionId,
                                execution_product_id: opts.executionProductId,
                                type: 'catalogador.lifestyle_editable.generated',
                                metadata: { scale: built.composition.scale },
                            });
                        }
                    }
                    catch (e) {
                        const message = e instanceof Error ? e.message : String(e);
                        // La propuesta queda en `error` con `generated_asset_id: null`, así que
                        // lo ya subido es inalcanzable: se borra acá o no se borra nunca.
                        await (0, asset_cleanup_1.cleanupUploadedFiles)(container, uploaded);
                        // Recorte/generación falló → la propuesta queda en error (PRD §14).
                        await service.createCatalogingAssetProposals([
                            {
                                execution_product_id: opts.executionProductId,
                                source_asset_id: mainUrl,
                                generated_asset_id: null,
                                operation_type: 'lifestyle_editable',
                                status: 'error',
                                is_ai_generated: true,
                                generation_provider: 'openrouter',
                                generation_model: config.image_ai.model,
                                metadata: { error: message },
                            },
                        ]);
                        created++;
                        warnings.push(`Lifestyle editable: ${message}`);
                        if (opts.executionId) {
                            await service.logActivity({
                                execution_id: opts.executionId,
                                execution_product_id: opts.executionProductId,
                                type: 'catalogador.lifestyle_editable.failed',
                                metadata: { phase: 'generate', message },
                            });
                        }
                    }
                    continue;
                }
                // Generar principal FALTANTE sin imagen propia: nunca se alucina. Con
                // una imagen real de la web se ofrecen DOS propuestas (real tal cual +
                // recreada IA con la real como referencia). Sin imagen real → se salta.
                if (op.field === 'generate_missing' && ownRefs.length === 0) {
                    const ext = await getExternalRefs();
                    if (!ext.firstBytes) {
                        // La razón importa: sin ella el operador no sabe si le falta
                        // habilitar la búsqueda web, si no hubo resultados o si todas las
                        // candidatas eran inutilizables.
                        const searchEnabled = config.external.scraping_enabled || config.external.barcode_enabled;
                        const reason = !searchEnabled
                            ? 'scraping_disabled'
                            : ext.candidateCount === 0
                                ? 'no_candidates'
                                : 'candidates_unusable';
                        const message = reason === 'scraping_disabled'
                            ? 'Sin imagen propia y con la búsqueda web deshabilitada: no se genera imagen (habilitá "Búsqueda web" en la configuración del Catalogador o cargá una foto manualmente).'
                            : reason === 'no_candidates'
                                ? 'Sin imagen propia y la búsqueda web no encontró imágenes del producto: no se genera imagen (requiere carga manual).'
                                : 'Sin imagen propia; la búsqueda web encontró imágenes pero ninguna es utilizable (no descargan o son demasiado chicas): no se genera imagen.';
                        warnings.push(message);
                        if (opts.executionId) {
                            await service.logActivity({
                                execution_id: opts.executionId,
                                execution_product_id: opts.executionProductId,
                                type: 'catalogador.image.skipped',
                                metadata: { reason, candidates: ext.candidateCount },
                            });
                        }
                        continue;
                    }
                    // Propuesta 1: imagen real importada tal cual (sólo procesamiento
                    // técnico a cuadrado blanco; SIN IA). Sólo si alcanza la calidad
                    // mínima del catálogo: una referencia chica sirve para la recreación
                    // IA pero no para importarla tal cual.
                    if (ext.belowMinDim) {
                        warnings.push('La imagen web encontrada es menor a la dimensión mínima: se usa sólo como referencia para la IA (no se importa tal cual).');
                    }
                    else {
                        const realOptimized = await (0, images_1.normalizeSquareWebp)(ext.firstBytes, {
                            size: Math.min(config.image_technical.max_dimension, 1200),
                            quality: config.image_technical.webp_quality,
                        });
                        const realAsset = await uploadResult(fileModule, mediaLibrary, title, realOptimized, false);
                        await service.createCatalogingAssetProposals([
                            {
                                execution_product_id: opts.executionProductId,
                                source_asset_id: ext.firstUrl,
                                generated_asset_id: realAsset?.url ?? null,
                                operation_type: 'import_external',
                                status: 'proposed',
                                is_ai_generated: false,
                                metadata: {
                                    source_url: ext.firstUrl,
                                    imported: true,
                                    bytes: realOptimized.bytes,
                                    file_id: realAsset?.id ?? null,
                                },
                            },
                        ]);
                        created++;
                    }
                    // Propuesta 2: recreación IA usando la imagen real como referencia fiel.
                    const recreated = await (0, images_1.generateProductImage)({
                        config,
                        kind: 'recreate',
                        productTitle: title,
                        referenceImages: ext.dataUrls,
                    });
                    const recAsset = await uploadResult(fileModule, mediaLibrary, title, recreated, true);
                    await service.createCatalogingAssetProposals([
                        {
                            execution_product_id: opts.executionProductId,
                            source_asset_id: ext.firstUrl,
                            generated_asset_id: recAsset?.url ?? null,
                            operation_type: 'generate_missing',
                            status: 'proposed',
                            is_ai_generated: true,
                            generation_provider: 'openrouter',
                            generation_model: config.image_ai.model,
                            metadata: {
                                from_external_reference: ext.firstUrl,
                                bytes: recreated.bytes,
                                file_id: recAsset?.id ?? null,
                            },
                        },
                    ]);
                    created++;
                    continue;
                }
                // Resto de operaciones IA (y generate_missing con imagen propia): usar la
                // referencia del producto; si no hay, una imagen real de la web. Sin
                // ninguna referencia real, NO se genera.
                const refs = ownRefs.length ? ownRefs : (await getExternalRefs()).dataUrls;
                if (refs.length === 0) {
                    warnings.push(`"${op.field}" requiere una imagen de referencia`);
                    continue;
                }
                const variations = Math.max(1, Math.min(config.image_ai.variations, config.image_ai.max_images_per_product));
                for (let i = 0; i < variations; i++) {
                    const result = await (0, images_1.generateProductImage)({
                        config,
                        kind: op.field,
                        productTitle: title,
                        referenceImages: refs,
                    });
                    const asset = await uploadResult(fileModule, mediaLibrary, title, result, true);
                    await service.createCatalogingAssetProposals([
                        {
                            execution_product_id: opts.executionProductId,
                            source_asset_id: mainUrl,
                            generated_asset_id: asset?.url ?? null,
                            operation_type: op.field,
                            status: 'proposed',
                            is_ai_generated: true,
                            generation_provider: 'openrouter',
                            generation_model: config.image_ai.model,
                            metadata: { variation: i + 1, bytes: result.bytes, file_id: asset?.id ?? null },
                        },
                    ]);
                    created++;
                }
            }
            catch (e) {
                warnings.push(`Imagen IA "${op.field}": ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
    return { created, warnings };
}
async function uploadResult(fileModule, mediaLibrary, title, image, aiGenerated) {
    const slug = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40);
    // La extensión sale del mimeType y NO es `.webp` fija: desde que "Convertir a
    // WebP" es opcional, el camino técnico puede emitir jpeg/png/avif, y un `.webp`
    // con bytes JPEG adentro rompe a cualquier consumidor que confíe en la extensión.
    const ext = (0, images_1.extensionForMime)(image.mimeType);
    const filename = `catalogador/${slug || 'producto'}-${aiGenerated ? 'ai' : 'opt'}-${randomToken()}.${ext}`;
    const [file] = await fileModule.createFiles([
        { filename, mimeType: image.mimeType, content: image.buffer.toString('base64'), access: 'public' },
    ]);
    if (!file)
        return null;
    if (mediaLibrary) {
        await mediaLibrary
            .registerAsset({
            url: file.url,
            file_id: file.id,
            filename,
            mime_type: image.mimeType,
            size: image.bytes,
            source: 'catalogador',
            metadata: { ai_generated: aiGenerated },
        })
            .catch(() => undefined);
    }
    return file;
}
// Sin Date.now()/Math.random() prohibidos en el harness de workflows, pero acá
// (job normal) están disponibles; igual usamos un token estable-ish para nombres.
function randomToken() {
    return Math.random().toString(36).slice(2, 10);
}
/**
 * Bytes de las imágenes candidatas del producto (principal primero), hasta un
 * tope. El recorte del lifestyle editable las prueba en orden buscando una de
 * fondo uniforme (la de catálogo sobre blanco) antes de caer al fallback IA.
 */
async function referenceBytesList(mainUrl, images, max = 4) {
    const candidates = [...new Set([mainUrl, ...images].filter((u) => Boolean(u)))].slice(0, max);
    const buffers = [];
    for (const url of candidates) {
        const bytes = await (0, images_1.fetchImageBytes)(url);
        if (bytes)
            buffers.push(bytes);
    }
    return buffers;
}
function safeResolve(container, key) {
    try {
        return container.resolve(key);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtcGlwZWxpbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jYXRhbG9nYWRvci9haS9pbWFnZS1waXBlbGluZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQXlDQSwwREFnYkM7QUF6ZEQscURBQStFO0FBRS9FLG9DQUE4QztBQUk5QyxxQ0FVa0I7QUFDbEIsNkRBQThGO0FBQzlGLG9EQUF3RDtBQUN4RCx5Q0FBbUQ7QUFDbkQsdUNBQStDO0FBRS9DLE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUM5RSxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFXdkg7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLHVCQUF1QixDQUFDLElBYTdDO0lBQ0MsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUM7SUFDbkMsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBMkIsMEJBQWtCLENBQUMsQ0FBQztJQUNoRixNQUFNLFVBQVUsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxJQUFJLENBQXdCLENBQUM7SUFDMUUsTUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFtQixTQUFTLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDL0UsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNqRSxNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7SUFFOUIsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNqQyxNQUFNLEVBQUUsU0FBUztRQUNqQixNQUFNLEVBQUU7WUFDTixJQUFJO1lBQ0osT0FBTztZQUNQLFdBQVc7WUFDWCxZQUFZO1lBQ1osY0FBYztZQUNkLGtCQUFrQjtZQUNsQixjQUFjO1lBQ2QsY0FBYztZQUNkLG1CQUFtQjtTQUNwQjtRQUNELE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFO0tBQ2hDLENBQUMsQ0FBQztJQUNILE1BQU0sT0FBTyxHQUFJLElBQXVDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUQsSUFBSSxDQUFDLE9BQU87UUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLENBQUM7SUFFMUUsTUFBTSxRQUFRLEdBQ1gsT0FBTyxDQUFDLFFBTU4sSUFBSSxFQUFFLENBQUM7SUFDWixNQUFNLE1BQU0sR0FBRyxDQUFFLE9BQU8sQ0FBQyxNQUFrQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQWEsQ0FBQztJQUNqSCxNQUFNLE9BQU8sR0FBSSxPQUFPLENBQUMsU0FBb0IsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ25FLE1BQU0sS0FBSyxHQUFJLE9BQU8sQ0FBQyxLQUFnQixJQUFJLFVBQVUsQ0FBQztJQUV0RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxpQkFBaUIsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxDQUFDO0lBQ3RHLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssaUJBQWlCLElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMxSCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ25GLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztJQUVoQiwrRUFBK0U7SUFDL0UsMEVBQTBFO0lBQzFFLGlGQUFpRjtJQUNqRixnRkFBZ0Y7SUFDaEYsbUZBQW1GO0lBQ25GLGtDQUFrQztJQUNsQyxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7SUFDeEIsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQWUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyRyxNQUFNLGdCQUFnQixHQUFHLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDbkUsdUVBQXVFO0lBQ3ZFLElBQUksa0JBQWtCLENBQUMsTUFBTSxHQUFHLFlBQVksRUFBRSxDQUFDO1FBQzdDLFFBQVEsQ0FBQyxJQUFJLENBQ1gscUJBQXFCLGtCQUFrQixDQUFDLE1BQU0sMENBQTBDLFlBQVksR0FBRyxDQUN4RyxDQUFDO0lBQ0osQ0FBQztJQUNELElBQUksVUFBVSxDQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNqRCxLQUFLLE1BQU0sR0FBRyxJQUFJLGdCQUFnQixFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDO2dCQUNILE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBQSx3QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO29CQUMvRCxTQUFTO2dCQUNYLENBQUM7Z0JBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLHFCQUFZLEVBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3ZDLDhFQUE4RTtnQkFDOUUsMEVBQTBFO2dCQUMxRSx3RUFBd0U7Z0JBQ3hFLDBFQUEwRTtnQkFDMUUsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLHlCQUFnQixFQUFDLEdBQUcsRUFBRTtvQkFDekMsR0FBRyxFQUFFLFVBQVU7b0JBQ2YsT0FBTyxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsWUFBWTtvQkFDNUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTTtvQkFDcEMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsYUFBYTtpQkFDbkQsQ0FBQyxDQUFDO2dCQUNILE1BQU0sS0FBSyxHQUFHLE1BQU0sWUFBWSxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDakYsSUFBSSxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQzFCLFFBQVEsQ0FBQyxJQUFJLENBQ1gsdUJBQXVCLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsaUNBQWlDO3dCQUNyRixHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSwrQkFBK0IsQ0FDbEUsQ0FBQztnQkFDSixDQUFDO2dCQUNELE1BQU0sT0FBTyxDQUFDLDhCQUE4QixDQUFDO29CQUMzQzt3QkFDRSxvQkFBb0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCO3dCQUM3QyxlQUFlLEVBQUUsR0FBRzt3QkFDcEIsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSSxJQUFJO3dCQUN0QyxjQUFjLEVBQUUsVUFBZ0M7d0JBQ2hELE1BQU0sRUFBRSxVQUFVO3dCQUNsQixlQUFlLEVBQUUsS0FBSzt3QkFDdEIsUUFBUSxFQUFFOzRCQUNSLEdBQUcsRUFBRSxVQUFVOzRCQUNmLFFBQVEsRUFBRSxHQUFHOzRCQUNiLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLElBQUk7NEJBQzFCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTs0QkFDckIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPOzRCQUN2QixnQkFBZ0IsRUFBRSxNQUFNLENBQUMsY0FBYzs0QkFDdkMsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUU7NEJBQzNFLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFO3lCQUMzRTtxQkFDRjtpQkFDRixDQUFDLENBQUM7Z0JBQ0gsT0FBTyxFQUFFLENBQUM7WUFDWixDQUFDO1lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDWCxRQUFRLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3pGLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELDhFQUE4RTtJQUM5RSw0RUFBNEU7SUFDNUUsOEVBQThFO0lBQzlFLDJFQUEyRTtJQUMzRSwwRUFBMEU7SUFDMUUsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDakIsTUFBTSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3pCLE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBZSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDbkgsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxDQUFDLElBQUksT0FBTyxFQUFFLENBQUM7WUFDeEIsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLHdCQUFlLEVBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkMsSUFBSSxLQUFLO2dCQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBQSxrQkFBUyxFQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQzFELENBQUM7UUFFRCxtRUFBbUU7UUFDbkUsdUVBQXVFO1FBQ3ZFLDhFQUE4RTtRQUM5RSxJQUFJLGtCQUFrQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQztRQUN0RCxJQUNFLGtCQUFrQixLQUFLLFNBQVM7WUFDaEMsT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQ3BCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssa0JBQWtCLENBQUMsRUFDakQsQ0FBQztZQUNELE1BQU0sT0FBTyxHQUFHLElBQUEsNEJBQWtCLEVBQUMsUUFBUSxDQUFDLENBQUM7WUFDN0MsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFBLGdDQUFxQixFQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQ3BFLGtCQUFrQixHQUFHLEdBQUcsRUFBRSxnQkFBZ0IsSUFBSSxFQUFFLENBQUM7WUFDakQsSUFBSSxHQUFHLEVBQUUsUUFBUSxFQUFFLE1BQU07Z0JBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsd0VBQXdFO1FBQ3hFLDBFQUEwRTtRQUMxRSx3RUFBd0U7UUFDeEUsdUVBQXVFO1FBQ3ZFLGdEQUFnRDtRQUNoRCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztRQUM3QixJQUFJLGlCQUFpQixHQU1WLElBQUksQ0FBQztRQUNoQixNQUFNLGVBQWUsR0FBRyxLQUFLLElBQUksRUFBRTtZQUNqQyxJQUFJLGlCQUFpQjtnQkFBRSxPQUFPLGlCQUFpQixDQUFDO1lBQ2hELE1BQU0sVUFBVSxHQUFHLENBQUMsa0JBQWtCLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUN2RSxNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7WUFDOUIsSUFBSSxVQUFVLEdBQWtCLElBQUksQ0FBQztZQUNyQyxJQUFJLFFBQVEsR0FBa0IsSUFBSSxDQUFDO1lBQ25DLElBQUksUUFBUSxHQUF3RCxJQUFJLENBQUM7WUFDekUsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO1lBQ3pELEtBQUssTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQzdCLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBQSx3QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN6QyxJQUFJLENBQUMsS0FBSztvQkFBRSxTQUFTO2dCQUNyQixJQUFJLElBQVksQ0FBQztnQkFDakIsSUFBSSxDQUFDO29CQUNILE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBQSxxQkFBWSxFQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN2QyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDM0MsQ0FBQztnQkFBQyxNQUFNLENBQUM7b0JBQ1AsU0FBUztnQkFDWCxDQUFDO2dCQUNELElBQUksTUFBTSxJQUFJLElBQUksR0FBRyxNQUFNLEVBQUUsQ0FBQztvQkFDNUIsSUFBSSxJQUFJLElBQUksZ0JBQWdCLElBQUksQ0FBQyxDQUFDLFFBQVEsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQzt3QkFBRSxRQUFRLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDO29CQUNyRyxTQUFTO2dCQUNYLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUNoQixVQUFVLEdBQUcsS0FBSyxDQUFDO29CQUNuQixRQUFRLEdBQUcsR0FBRyxDQUFDO2dCQUNqQixDQUFDO2dCQUNELFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBQSxrQkFBUyxFQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLFFBQVEsQ0FBQyxNQUFNLElBQUksQ0FBQztvQkFBRSxNQUFNO1lBQ2xDLENBQUM7WUFDRCxJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUM7WUFDeEIsSUFBSSxDQUFDLFVBQVUsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDNUIsV0FBVyxHQUFHLElBQUksQ0FBQztnQkFDbkIsVUFBVSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7Z0JBQzVCLFFBQVEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDO2dCQUN4QixRQUFRLENBQUMsSUFBSSxDQUFDLElBQUEsa0JBQVMsRUFBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDekQsQ0FBQztZQUNELGlCQUFpQixHQUFHLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkcsT0FBTyxpQkFBaUIsQ0FBQztRQUMzQixDQUFDLENBQUM7UUFFRixLQUFLLE1BQU0sRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQztnQkFDSCwwRUFBMEU7Z0JBQzFFLHFFQUFxRTtnQkFDckUsbUVBQW1FO2dCQUNuRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLEtBQUssb0JBQW9CLEVBQUUsQ0FBQztvQkFDdEMseUVBQXlFO29CQUN6RSwwRUFBMEU7b0JBQzFFLDJFQUEyRTtvQkFDM0UsZ0RBQWdEO29CQUNoRCxNQUFNLFFBQVEsR0FBOEMsRUFBRSxDQUFDO29CQUMvRCxJQUFJLENBQUM7d0JBQ0gsTUFBTSxVQUFVLEdBQUcsTUFBTSxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7d0JBQzdELElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQzs0QkFDNUIsUUFBUSxDQUFDLElBQUksQ0FBQyx3REFBd0QsQ0FBQyxDQUFDOzRCQUN4RSxTQUFTO3dCQUNYLENBQUM7d0JBQ0QsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLDJDQUFzQixFQUFDLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQzt3QkFDeEYsTUFBTSxZQUFZLEdBQUcsTUFBTSxZQUFZLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDOUYsUUFBUSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQzt3QkFDNUIsTUFBTSxlQUFlLEdBQUcsTUFBTSxZQUFZLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDcEcsUUFBUSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQzt3QkFDL0IsTUFBTSxZQUFZLEdBQUcsTUFBTSxZQUFZLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDOUYsUUFBUSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQzt3QkFDNUIsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDOzRCQUN2RCxNQUFNLElBQUksS0FBSyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7d0JBQzdFLENBQUM7d0JBQ0QsTUFBTSxRQUFRLEdBQThCOzRCQUMxQyxPQUFPLEVBQUUsQ0FBQzs0QkFDVixVQUFVLEVBQUUsRUFBRSxHQUFHLEVBQUUsZUFBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsZUFBZSxDQUFDLEVBQUUsRUFBRTs0QkFDckUsYUFBYSxFQUFFLEVBQUUsR0FBRyxFQUFFLFlBQVksQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLE9BQU8sSUFBSSxFQUFFLEVBQUU7NEJBQzdGLHFFQUFxRTs0QkFDckUsb0VBQW9FOzRCQUNwRSx5Q0FBeUM7NEJBQ3pDLE9BQU8sRUFBRSxFQUFFLEdBQUcsRUFBRSxZQUFZLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsRUFBRSxFQUFFOzRCQUM1RCxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7NEJBQzlCLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxXQUFXO3lCQUN2QyxDQUFDO3dCQUNGLE1BQU0sT0FBTyxDQUFDLDhCQUE4QixDQUFDOzRCQUMzQztnQ0FDRSxvQkFBb0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCO2dDQUM3QyxlQUFlLEVBQUUsT0FBTztnQ0FDeEIsa0JBQWtCLEVBQUUsWUFBWSxDQUFDLEdBQUc7Z0NBQ3BDLGNBQWMsRUFBRSxvQkFBMEM7Z0NBQzFELE1BQU0sRUFBRSxVQUFVO2dDQUNsQixlQUFlLEVBQUUsSUFBSTtnQ0FDckIsbUJBQW1CLEVBQUUsWUFBWTtnQ0FDakMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLO2dDQUN2QyxRQUFRLEVBQUUsUUFBOEM7NkJBQ3pEO3lCQUNGLENBQUMsQ0FBQzt3QkFDSCxPQUFPLEVBQUUsQ0FBQzt3QkFDVixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQzs0QkFDckIsTUFBTSxPQUFPLENBQUMsV0FBVyxDQUFDO2dDQUN4QixZQUFZLEVBQUUsSUFBSSxDQUFDLFdBQVc7Z0NBQzlCLG9CQUFvQixFQUFFLElBQUksQ0FBQyxrQkFBa0I7Z0NBQzdDLElBQUksRUFBRSwwQ0FBMEM7Z0NBQ2hELFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRTs2QkFDN0MsQ0FBQyxDQUFDO3dCQUNMLENBQUM7b0JBQ0gsQ0FBQztvQkFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO3dCQUNYLE1BQU0sT0FBTyxHQUFHLENBQUMsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDM0Qsd0VBQXdFO3dCQUN4RSxrRUFBa0U7d0JBQ2xFLE1BQU0sSUFBQSxvQ0FBb0IsRUFBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBQ2hELG9FQUFvRTt3QkFDcEUsTUFBTSxPQUFPLENBQUMsOEJBQThCLENBQUM7NEJBQzNDO2dDQUNFLG9CQUFvQixFQUFFLElBQUksQ0FBQyxrQkFBa0I7Z0NBQzdDLGVBQWUsRUFBRSxPQUFPO2dDQUN4QixrQkFBa0IsRUFBRSxJQUFJO2dDQUN4QixjQUFjLEVBQUUsb0JBQTBDO2dDQUMxRCxNQUFNLEVBQUUsT0FBTztnQ0FDZixlQUFlLEVBQUUsSUFBSTtnQ0FDckIsbUJBQW1CLEVBQUUsWUFBWTtnQ0FDakMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLO2dDQUN2QyxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFOzZCQUM3Qjt5QkFDRixDQUFDLENBQUM7d0JBQ0gsT0FBTyxFQUFFLENBQUM7d0JBQ1YsUUFBUSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsT0FBTyxFQUFFLENBQUMsQ0FBQzt3QkFDaEQsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7NEJBQ3JCLE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQztnQ0FDeEIsWUFBWSxFQUFFLElBQUksQ0FBQyxXQUFXO2dDQUM5QixvQkFBb0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCO2dDQUM3QyxJQUFJLEVBQUUsdUNBQXVDO2dDQUM3QyxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRTs2QkFDekMsQ0FBQyxDQUFDO3dCQUNMLENBQUM7b0JBQ0gsQ0FBQztvQkFDRCxTQUFTO2dCQUNYLENBQUM7Z0JBRUQsc0VBQXNFO2dCQUN0RSx1RUFBdUU7Z0JBQ3ZFLHdFQUF3RTtnQkFDeEUsSUFBSSxFQUFFLENBQUMsS0FBSyxLQUFLLGtCQUFrQixJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQzVELE1BQU0sR0FBRyxHQUFHLE1BQU0sZUFBZSxFQUFFLENBQUM7b0JBQ3BDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUM7d0JBQ3BCLDZEQUE2RDt3QkFDN0Qsa0VBQWtFO3dCQUNsRSxpQ0FBaUM7d0JBQ2pDLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUM7d0JBQzFGLE1BQU0sTUFBTSxHQUFHLENBQUMsYUFBYTs0QkFDM0IsQ0FBQyxDQUFDLG1CQUFtQjs0QkFDckIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEtBQUssQ0FBQztnQ0FDeEIsQ0FBQyxDQUFDLGVBQWU7Z0NBQ2pCLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQzt3QkFDNUIsTUFBTSxPQUFPLEdBQ1gsTUFBTSxLQUFLLG1CQUFtQjs0QkFDNUIsQ0FBQyxDQUFDLHdLQUF3Szs0QkFDMUssQ0FBQyxDQUFDLE1BQU0sS0FBSyxlQUFlO2dDQUMxQixDQUFDLENBQUMscUhBQXFIO2dDQUN2SCxDQUFDLENBQUMsNklBQTZJLENBQUM7d0JBQ3RKLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7d0JBQ3ZCLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDOzRCQUNyQixNQUFNLE9BQU8sQ0FBQyxXQUFXLENBQUM7Z0NBQ3hCLFlBQVksRUFBRSxJQUFJLENBQUMsV0FBVztnQ0FDOUIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLGtCQUFrQjtnQ0FDN0MsSUFBSSxFQUFFLDJCQUEyQjtnQ0FDakMsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLENBQUMsY0FBYyxFQUFFOzZCQUNyRCxDQUFDLENBQUM7d0JBQ0wsQ0FBQzt3QkFDRCxTQUFTO29CQUNYLENBQUM7b0JBQ0Qsa0VBQWtFO29CQUNsRSxpRUFBaUU7b0JBQ2pFLHFFQUFxRTtvQkFDckUsdUNBQXVDO29CQUN2QyxJQUFJLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDcEIsUUFBUSxDQUFDLElBQUksQ0FDWCwySEFBMkgsQ0FDNUgsQ0FBQztvQkFDSixDQUFDO3lCQUFNLENBQUM7d0JBQ04sTUFBTSxhQUFhLEdBQUcsTUFBTSxJQUFBLDRCQUFtQixFQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUU7NEJBQzlELElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQzs0QkFDMUQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsWUFBWTt5QkFDN0MsQ0FBQyxDQUFDO3dCQUNILE1BQU0sU0FBUyxHQUFHLE1BQU0sWUFBWSxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDNUYsTUFBTSxPQUFPLENBQUMsOEJBQThCLENBQUM7NEJBQzNDO2dDQUNFLG9CQUFvQixFQUFFLElBQUksQ0FBQyxrQkFBa0I7Z0NBQzdDLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUTtnQ0FDN0Isa0JBQWtCLEVBQUUsU0FBUyxFQUFFLEdBQUcsSUFBSSxJQUFJO2dDQUMxQyxjQUFjLEVBQUUsaUJBQXVDO2dDQUN2RCxNQUFNLEVBQUUsVUFBVTtnQ0FDbEIsZUFBZSxFQUFFLEtBQUs7Z0NBQ3RCLFFBQVEsRUFBRTtvQ0FDUixVQUFVLEVBQUUsR0FBRyxDQUFDLFFBQVE7b0NBQ3hCLFFBQVEsRUFBRSxJQUFJO29DQUNkLEtBQUssRUFBRSxhQUFhLENBQUMsS0FBSztvQ0FDMUIsT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLElBQUksSUFBSTtpQ0FDL0I7NkJBQ0Y7eUJBQ0YsQ0FBQyxDQUFDO3dCQUNILE9BQU8sRUFBRSxDQUFDO29CQUNaLENBQUM7b0JBQ0QseUVBQXlFO29CQUN6RSxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUEsNkJBQW9CLEVBQUM7d0JBQzNDLE1BQU07d0JBQ04sSUFBSSxFQUFFLFVBQVU7d0JBQ2hCLFlBQVksRUFBRSxLQUFLO3dCQUNuQixlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVE7cUJBQzlCLENBQUMsQ0FBQztvQkFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLFlBQVksQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ3RGLE1BQU0sT0FBTyxDQUFDLDhCQUE4QixDQUFDO3dCQUMzQzs0QkFDRSxvQkFBb0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCOzRCQUM3QyxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVE7NEJBQzdCLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxHQUFHLElBQUksSUFBSTs0QkFDekMsY0FBYyxFQUFFLGtCQUF3Qzs0QkFDeEQsTUFBTSxFQUFFLFVBQVU7NEJBQ2xCLGVBQWUsRUFBRSxJQUFJOzRCQUNyQixtQkFBbUIsRUFBRSxZQUFZOzRCQUNqQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUs7NEJBQ3ZDLFFBQVEsRUFBRTtnQ0FDUix1QkFBdUIsRUFBRSxHQUFHLENBQUMsUUFBUTtnQ0FDckMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLO2dDQUN0QixPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsSUFBSSxJQUFJOzZCQUM5Qjt5QkFDRjtxQkFDRixDQUFDLENBQUM7b0JBQ0gsT0FBTyxFQUFFLENBQUM7b0JBQ1YsU0FBUztnQkFDWCxDQUFDO2dCQUVELDBFQUEwRTtnQkFDMUUscUVBQXFFO2dCQUNyRSx5Q0FBeUM7Z0JBQ3pDLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLGVBQWUsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUMzRSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3RCLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxxQ0FBcUMsQ0FBQyxDQUFDO29CQUNqRSxTQUFTO2dCQUNYLENBQUM7Z0JBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztnQkFDN0csS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUNwQyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsNkJBQW9CLEVBQUM7d0JBQ3hDLE1BQU07d0JBQ04sSUFBSSxFQUFFLEVBQUUsQ0FBQyxLQUFvQjt3QkFDN0IsWUFBWSxFQUFFLEtBQUs7d0JBQ25CLGVBQWUsRUFBRSxJQUFJO3FCQUN0QixDQUFDLENBQUM7b0JBQ0gsTUFBTSxLQUFLLEdBQUcsTUFBTSxZQUFZLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNoRixNQUFNLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQzt3QkFDM0M7NEJBQ0Usb0JBQW9CLEVBQUUsSUFBSSxDQUFDLGtCQUFrQjs0QkFDN0MsZUFBZSxFQUFFLE9BQU87NEJBQ3hCLGtCQUFrQixFQUFFLEtBQUssRUFBRSxHQUFHLElBQUksSUFBSTs0QkFDdEMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxLQUEyQjs0QkFDOUMsTUFBTSxFQUFFLFVBQVU7NEJBQ2xCLGVBQWUsRUFBRSxJQUFJOzRCQUNyQixtQkFBbUIsRUFBRSxZQUFZOzRCQUNqQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUs7NEJBQ3ZDLFFBQVEsRUFBRSxFQUFFLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLElBQUksRUFBRTt5QkFDaEY7cUJBQ0YsQ0FBQyxDQUFDO29CQUNILE9BQU8sRUFBRSxDQUFDO2dCQUNaLENBQUM7WUFDSCxDQUFDO1lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDWCxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLEtBQUssTUFBTSxDQUFDLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFGLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLENBQUM7QUFDL0IsQ0FBQztBQUVELEtBQUssVUFBVSxZQUFZLENBQ3pCLFVBQW9CLEVBQ3BCLFlBQXFDLEVBQ3JDLEtBQWEsRUFDYixLQUFxQixFQUNyQixXQUFvQjtJQUVwQixNQUFNLElBQUksR0FBRyxLQUFLO1NBQ2YsU0FBUyxDQUFDLEtBQUssQ0FBQztTQUNoQixPQUFPLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDO1NBQy9CLFdBQVcsRUFBRTtTQUNiLE9BQU8sQ0FBQyxhQUFhLEVBQUUsR0FBRyxDQUFDO1NBQzNCLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1NBQ3ZCLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDaEIsOEVBQThFO0lBQzlFLGdGQUFnRjtJQUNoRixrRkFBa0Y7SUFDbEYsTUFBTSxHQUFHLEdBQUcsSUFBQSx5QkFBZ0IsRUFBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDN0MsTUFBTSxRQUFRLEdBQUcsZUFBZSxJQUFJLElBQUksVUFBVSxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksV0FBVyxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7SUFDM0csTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sVUFBVSxDQUFDLFdBQVcsQ0FBQztRQUMxQyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtLQUNuRyxDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQ3ZCLElBQUksWUFBWSxFQUFFLENBQUM7UUFDakIsTUFBTSxZQUFZO2FBQ2YsYUFBYSxDQUFDO1lBQ2IsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHO1lBQ2IsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ2hCLFFBQVE7WUFDUixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7WUFDekIsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLO1lBQ2pCLE1BQU0sRUFBRSxhQUFhO1lBQ3JCLFFBQVEsRUFBRSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUU7U0FDeEMsQ0FBQzthQUNELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsK0VBQStFO0FBQy9FLGtGQUFrRjtBQUNsRixTQUFTLFdBQVc7SUFDbEIsT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDakQsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxLQUFLLFVBQVUsa0JBQWtCLENBQUMsT0FBc0IsRUFBRSxNQUFnQixFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2pGLE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBZSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDM0csTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO0lBQzdCLEtBQUssTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7UUFDN0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLHdCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7UUFDekMsSUFBSSxLQUFLO1lBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ0QsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFJLFNBQTBCLEVBQUUsR0FBVztJQUM3RCxJQUFJLENBQUM7UUFDSCxPQUFPLFNBQVMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFNLENBQUM7SUFDckMsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztBQUNILENBQUMifQ==