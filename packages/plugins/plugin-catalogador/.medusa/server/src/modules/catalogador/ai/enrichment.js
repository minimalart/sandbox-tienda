"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTaxonomy = void 0;
exports.evidenceConfidence = evidenceConfidence;
exports.generateForProduct = generateForProduct;
const utils_1 = require("@medusajs/framework/utils");
const openrouter_1 = require("./openrouter");
const prompts_1 = require("./prompts");
const taxonomy_1 = require("./taxonomy");
Object.defineProperty(exports, "loadTaxonomy", { enumerable: true, get: function () { return taxonomy_1.loadTaxonomy; } });
const external_1 = require("./external");
const barcode_1 = require("./barcode");
/**
 * Confianza según la fuerza de la evidencia disponible (PRD §13). No es un
 * sistema sofisticado: mapea las fuentes que realmente alimentaron la propuesta
 * a un valor orientativo.
 *
 * La foto del producto cuenta como evidencia de primera mano: cuando hay imagen
 * el modelo la mira (va como `image_url` en el mensaje) y describe lo que ve, no
 * lo que deduce del título. Antes esta función sólo puntuaba barcode y scraping
 * —las dos fuentes EXTERNAS—, así que un tenant con ambas apagadas en su config
 * tenía un techo alcanzable de 0.55 contra el umbral por default de 0.7: el gate
 * de `require_review_low_confidence` difería el 100% de los campos siempre y
 * "aceptar todo" era incapaz de aceptar nada. Un gate cuyo techo está por debajo
 * de su propio umbral no discrimina: sólo apaga el botón.
 *
 * Con la imagen puntuando, el gate vuelve a separar dos casos que sí son
 * distintos: producto CON foto (0.7, el modelo vio el envase) y producto SIN
 * foto (0.55, la IA está infiriendo del catálogo) — que es justo donde querés
 * ojo humano.
 */
function evidenceConfidence(opts) {
    if (opts.usedBarcode && opts.pageHits >= 1)
        return 0.9; // barcode + página
    if (opts.usedBarcode)
        return 0.8; // API barcode con respuesta
    if (opts.pageHits >= 2)
        return 0.7; // dos páginas coincidentes
    if (opts.hasImage)
        return 0.7; // el modelo vio la foto del producto
    if (opts.pageHits >= 1)
        return 0.6; // una página
    return 0.55; // sólo inferencia del catálogo, sin foto
}
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Descarga una imagen pública y la vuelve data URL para visión (best-effort). */
async function fetchImageDataUrl(url) {
    if (!url || !/^https?:\/\//i.test(url))
        return null;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok)
            return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_IMAGE_BYTES)
            return null;
        const mime = res.headers.get('content-type') || 'image/jpeg';
        if (!mime.startsWith('image/'))
            return null;
        return `data:${mime};base64,${buf.toString('base64')}`;
    }
    catch {
        return null;
    }
}
function stableHash(obj) {
    const str = JSON.stringify(obj);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return `h${(h >>> 0).toString(16)}`;
}
/** Campos de texto libres protegidos por la regla "no sobrescribir manual". */
const FREEFORM_FIELDS = ['subtitle', 'description', 'meta_title', 'meta_description', 'alt_text'];
/**
 * Genera propuestas para un producto (PRD §13.1). Orden: lee info existente →
 * taxonomías → imagen → contexto externo (barcode/scraping) → IA → validación.
 * NO escribe en el catálogo: sólo devuelve las propuestas para revisión.
 */
async function generateForProduct(opts) {
    const { container, productId, config, taxonomy, attempt } = opts;
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const fields = opts.fields.filter((f) => prompts_1.TEXT_FIELDS.includes(f));
    const warnings = [];
    const { data } = await query.graph({
        entity: 'product',
        fields: [
            'id',
            'title',
            'subtitle',
            'description',
            'status',
            'thumbnail',
            'metadata',
            'images.url',
            'collection.title',
            'categories.id',
            'categories.name',
            'tags.id',
            'tags.value',
            'variants.sku',
            'variants.barcode',
            'variants.ean',
            'variants.upc',
            'variants.metadata',
        ],
        filters: { id: productId },
    });
    const product = data[0];
    if (!product)
        throw new Error(`Producto ${productId} no encontrado`);
    const variants = product.variants ?? [];
    const images = product.images ?? [];
    const thumbnail = product.thumbnail || images[0]?.url || null;
    const ctx = {
        title: product.title,
        subtitle: product.subtitle ?? null,
        description: product.description ?? null,
        collection: product.collection?.title ?? null,
        brand: null,
        category_paths: (product.categories ?? [])
            .map((c) => c.name)
            .filter(Boolean),
        tag_values: (product.tags ?? [])
            .map((t) => t.value)
            .filter(Boolean),
        variant_skus: variants.map((v) => v.sku).filter(Boolean),
        metadata: product.metadata ?? null,
        has_image: Boolean(thumbnail),
    };
    // Imágenes para visión (sólo si aporta a campos de contenido). Se usan TODAS
    // las imágenes del producto como referencia (no sólo la principal), hasta un
    // tope para no inflar el payload.
    const MAX_VISION_IMAGES = 6;
    const wantsVision = fields.some((f) => ['description', 'subtitle', 'alt_text', 'categories', 'tags'].includes(f));
    const allImageUrls = [thumbnail, ...images.map((i) => i.url)].filter((u) => Boolean(u));
    const uniqueImageUrls = [...new Set(allImageUrls)].slice(0, MAX_VISION_IMAGES);
    const imageDataUrls = wantsVision
        ? (await Promise.all(uniqueImageUrls.map((u) => fetchImageDataUrl(u)))).filter((u) => Boolean(u))
        : [];
    // Contexto externo (barcode/scraping) — sólo como referencia (PRD §13.2).
    // El código se toma de barcode/ean/upc/metadata/sku (no sólo `barcode`) y se
    // valida el formato antes de consultar.
    const barcode = (0, barcode_1.pickProductBarcode)(variants);
    const external = await (0, external_1.gatherExternalContext)({ config, barcode, title: ctx.title });
    if (external?.warnings?.length)
        warnings.push(...external.warnings);
    const { system, userText } = (0, prompts_1.buildEnrichmentMessages)({
        config,
        fields,
        product: ctx,
        allowedCategories: taxonomy.categories.map((c) => c.path),
        allowedTags: taxonomy.tags.map((t) => t.value),
        imageDataUrl: imageDataUrls[0] ?? null,
        externalContext: external?.summary ?? null,
    });
    const userContent = imageDataUrls.length > 0
        ? {
            role: 'user',
            content: [
                { type: 'text', text: userText },
                ...imageDataUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
        }
        : { role: 'user', content: userText };
    const { content, usage } = await (0, openrouter_1.chatComplete)({
        model: config.text.model,
        messages: [{ role: 'system', content: system }, userContent],
        temperature: config.text.temperature,
        maxTokens: config.text.max_tokens,
        reasoningEffort: config.text.reasoning_effort,
        jsonMode: true,
    });
    const parsed = (0, openrouter_1.extractJson)(content);
    if (!parsed) {
        throw new Error('El modelo no devolvió un JSON válido.');
    }
    const sourceTrace = {
        catalog: true,
        image: imageDataUrls.length > 0,
        barcode: Boolean(external?.used_barcode),
        scraping: Boolean(external?.used_scraping),
        ai_inferred: true,
    };
    // Confianza base derivada de la evidencia externa real (no una constante).
    const baseConfidence = evidenceConfidence({
        usedBarcode: Boolean(external?.used_barcode),
        pageHits: external?.page_hits ?? 0,
        hasImage: imageDataUrls.length > 0,
    });
    const proposed = {};
    const snapshot = {};
    for (const field of fields) {
        const raw = parsed[field];
        if (raw === undefined || raw === null)
            continue;
        // Reglas de catálogo (PRD §22.5).
        const currentVal = currentFieldValue(product, ctx, field);
        snapshot[field] = currentVal ?? null;
        const isFreeform = FREEFORM_FIELDS.includes(field);
        const hasManualValue = currentVal != null && String(currentVal).trim() !== '' && (!Array.isArray(currentVal) || currentVal.length > 0);
        if (config.rules.only_fill_empty && hasManualValue)
            continue;
        if (config.rules.do_not_overwrite_manual && isFreeform && hasManualValue && !config.rules.allow_improve_existing) {
            continue;
        }
        let value = raw;
        const fieldWarnings = [];
        if (field === 'categories') {
            const names = Array.isArray(raw) ? raw.map(String) : [];
            const ids = (0, taxonomy_1.resolveCategoryIds)(taxonomy, names);
            if (names.length && !ids.length)
                fieldWarnings.push('Ninguna categoría propuesta coincide con las existentes.');
            value = ids;
            if (!ids.length)
                continue;
        }
        else if (field === 'tags') {
            const values = Array.isArray(raw) ? raw.map(String) : [];
            const ids = (0, taxonomy_1.resolveTagIds)(taxonomy, values);
            if (values.length && !ids.length)
                fieldWarnings.push('Ningún tag propuesto coincide con los existentes.');
            value = ids;
            if (!ids.length)
                continue;
        }
        else if (field === 'keywords') {
            value = Array.isArray(raw) ? raw.map(String) : String(raw).split(',').map((s) => s.trim());
        }
        else {
            value = String(raw).trim();
            if (!value)
                continue;
        }
        // Un campo con advertencias (p.ej. categorías/tags que no matchearon) baja
        // a la confianza mínima aunque la evidencia global sea fuerte.
        const confidence = fieldWarnings.length ? Math.min(baseConfidence, 0.55) : baseConfidence;
        proposed[field] = {
            value,
            attempt,
            confidence,
            source_trace: sourceTrace,
            warnings: fieldWarnings.length ? fieldWarnings : undefined,
        };
    }
    return {
        proposed_changes: proposed,
        current_snapshot: snapshot,
        product_version_reference: { hash: stableHash(snapshot), captured_at: new Date().toISOString() },
        external_context_summary: external
            ? { used_barcode: external.used_barcode, used_scraping: external.used_scraping, sources: external.sources }
            : null,
        external_image_candidates: external?.image_candidates ?? [],
        warnings,
        usage,
        no_changes: Object.keys(proposed).length === 0,
    };
}
/** Valor actual del campo (para snapshot + reglas). */
function currentFieldValue(product, ctx, field) {
    switch (field) {
        case 'subtitle':
            return ctx.subtitle;
        case 'description':
            return ctx.description;
        case 'categories':
            return (product.categories ?? []).map((c) => c.id).filter(Boolean);
        case 'tags':
            return (product.tags ?? []).map((t) => t.id).filter(Boolean);
        case 'meta_title':
            return ctx.metadata?.meta_title ?? null;
        case 'meta_description':
            return ctx.metadata?.meta_description ?? null;
        case 'keywords':
            return ctx.metadata?.keywords ?? null;
        case 'alt_text':
            return ctx.metadata?.alt_text ?? null;
        default:
            return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5yaWNobWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL2FpL2VucmljaG1lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBOERBLGdEQU9DO0FBd0NELGdEQStNQztBQTVURCxxREFBc0U7QUFHdEUsNkNBQTJGO0FBQzNGLHVDQUttQjtBQUNuQix5Q0FBNEY7QUFnVm5GLDZGQWhWQSx1QkFBWSxPQWdWQTtBQS9VckIseUNBQW1EO0FBQ25ELHVDQUErQztBQStCL0M7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtCRztBQUNILFNBQWdCLGtCQUFrQixDQUFDLElBQW1FO0lBQ3BHLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUM7UUFBRSxPQUFPLEdBQUcsQ0FBQyxDQUFDLG1CQUFtQjtJQUMzRSxJQUFJLElBQUksQ0FBQyxXQUFXO1FBQUUsT0FBTyxHQUFHLENBQUMsQ0FBQyw0QkFBNEI7SUFDOUQsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUM7UUFBRSxPQUFPLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQjtJQUMvRCxJQUFJLElBQUksQ0FBQyxRQUFRO1FBQUUsT0FBTyxHQUFHLENBQUMsQ0FBQyxxQ0FBcUM7SUFDcEUsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUM7UUFBRSxPQUFPLEdBQUcsQ0FBQyxDQUFDLGFBQWE7SUFDakQsT0FBTyxJQUFJLENBQUMsQ0FBQyx5Q0FBeUM7QUFDeEQsQ0FBQztBQUVELE1BQU0sZUFBZSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBRXhDLGtGQUFrRjtBQUNsRixLQUFLLFVBQVUsaUJBQWlCLENBQUMsR0FBOEI7SUFDN0QsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7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