"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_EDITABLE_COMPOSITION = exports.EDITABLE_MAX_SCALE = exports.EDITABLE_MIN_SCALE = void 0;
exports.clampComposition = clampComposition;
exports.removeProductBackground = removeProductBackground;
exports.generateLifestyleBackground = generateLifestyleBackground;
exports.renderEditableLifestyle = renderEditableLifestyle;
exports.buildEditableLifestyle = buildEditableLifestyle;
const sharp_1 = __importDefault(require("sharp"));
const openrouter_1 = require("./openrouter");
const images_1 = require("./images");
/**
 * Lifestyle editable (PRD §8): agregado acotado sobre el lifestyle actual que
 * permite corregir manualmente el tamaño y la posición del producto antes de
 * aplicar la imagen. NO es un motor de composición genérico (PRD §21): sólo
 *   - extrae el producto con fondo transparente (un único mecanismo: IA),
 *   - genera un fondo lifestyle SIN el producto,
 *   - compone el producto sobre el fondo con una posición/escala normalizada.
 *
 * El render final (al aplicar) reutiliza `renderEditableLifestyle`. Guardar una
 * edición NO vuelve a llamar al proveedor de IA (PRD §6.4): sólo persiste la
 * composición en `metadata`.
 */
/** Límites de escala (PRD §13): constantes, no administrables en el MVP. */
exports.EDITABLE_MIN_SCALE = 0.08;
exports.EDITABLE_MAX_SCALE = 0.7;
/**
 * Composición inicial determinística (PRD §8.3): esquina inferior-derecha, que
 * es la zona que el prompt del fondo reserva libre. La escala inicial la fija
 * la config; la posición se mantiene como constante interna en el MVP.
 */
exports.DEFAULT_EDITABLE_COMPOSITION = { x: 0.7, y: 0.75, scale: 0.25 };
/**
 * Recorte (PRD §8.1). Los modelos de imagen (nano-banana) NO devuelven un PNG
 * con alpha real de forma confiable; en cambio SÍ colocan el producto sobre un
 * fondo sólido cuando se les pide. Recreamos el producto sobre un magenta puro
 * y luego keyeamos ese fondo a transparente con Sharp (flood fill desde los
 * bordes, así el interior del producto nunca se perfora). Si el ORIGINAL ya
 * tiene fondo casi uniforme (catálogo sobre blanco) se keyea directo sin IA.
 */
const CHROMA_TOLERANCE = 140; // distancia RGB máx. al color de borde (chroma).
const DIRECT_TOLERANCE = 60; // ídem para el recorte directo del original.
const DIRECT_MAX_BORDER_STD = 12; // desvío máx. del borde para considerarlo uniforme.
const REMOVE_BG_PROMPT = 'Recreate ONLY the main product from this photo, perfectly faithful to the original (exact same shape, colors, proportions and printed branding), centered and fully visible, and place it on a PERFECTLY UNIFORM solid pure magenta background of EXACT color #FF00FF (RGB 255,0,255). The background must be a single flat solid magenta filling the entire frame, with NO gradient, NO shadow, NO reflection, NO vignette and NO other objects. Do not add any text. Everything that is not the product must be pure #FF00FF magenta.';
function clamp(n, min, max) {
    if (Number.isNaN(n))
        return min;
    return Math.min(Math.max(n, min), max);
}
/** Aplica los límites del PRD §14 (x/y ∈ [0,1], scale ∈ [MIN,MAX]). */
function clampComposition(c, defaultScale = exports.DEFAULT_EDITABLE_COMPOSITION.scale) {
    return {
        x: clamp(typeof c.x === 'number' ? c.x : exports.DEFAULT_EDITABLE_COMPOSITION.x, 0, 1),
        y: clamp(typeof c.y === 'number' ? c.y : exports.DEFAULT_EDITABLE_COMPOSITION.y, 0, 1),
        scale: clamp(typeof c.scale === 'number' ? c.scale : defaultScale, exports.EDITABLE_MIN_SCALE, exports.EDITABLE_MAX_SCALE),
    };
}
/** ¿El buffer tiene transparencia REAL (no sólo un canal alpha todo opaco)? */
async function hasRealAlpha(buffer) {
    try {
        const meta = await (0, sharp_1.default)(buffer).metadata();
        if (!meta.hasAlpha)
            return false;
        const stats = await (0, sharp_1.default)(buffer).stats();
        return !stats.isOpaque;
    }
    catch {
        return false;
    }
}
async function mimeOf(buffer) {
    try {
        const fmt = (await (0, sharp_1.default)(buffer).metadata()).format;
        return fmt ? `image/${fmt === 'jpg' ? 'jpeg' : fmt}` : 'image/png';
    }
    catch {
        return 'image/png';
    }
}
/** Recorta márgenes transparentes excesivos; tolera imágenes uniformes. */
async function trimTransparent(buffer) {
    try {
        return await (0, sharp_1.default)(buffer).trim().toBuffer();
    }
    catch {
        return buffer;
    }
}
/** Codifica preservando el canal alpha (para la capa del producto). */
async function encodeAlphaWebp(input, maxDimension, quality) {
    const { data, info } = await (0, sharp_1.default)(input)
        .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: clamp(Math.round(quality), 40, 100), alphaQuality: 100, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    return { buffer: data, mimeType: 'image/webp', bytes: data.length, width: info.width, height: info.height };
}
/**
 * Convierte a transparente el fondo mediante FLOOD FILL desde los bordes: sólo
 * se keyean los píxeles cercanos al color de fondo Y CONECTADOS al borde de la
 * imagen. Así los colores parecidos al fondo DENTRO del producto (p.ej. una
 * pantalla con contenido rosa/violeta frente a un chroma magenta) nunca se
 * perforan. Determinístico (no depende del modelo). Devuelve un PNG con alpha y
 * la fracción keyeada (para validar el recorte).
 */
async function floodKeyToAlpha(buffer, tolerance) {
    const { data, info } = await (0, sharp_1.default)(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels; // 4 tras ensureAlpha
    const w = info.width;
    const h = info.height;
    const total = w * h;
    // El color de fondo real se toma del borde (tolera drift del chroma pedido).
    const key = borderStats(data, w, h, channels).mean;
    const tol2 = tolerance * tolerance;
    const matches = (p) => {
        const i = p * channels;
        const dr = (data[i] ?? 0) - key.r;
        const dg = (data[i + 1] ?? 0) - key.g;
        const db = (data[i + 2] ?? 0) - key.b;
        return dr * dr + dg * dg + db * db <= tol2;
    };
    const visited = new Uint8Array(total);
    const stack = [];
    const seed = (p) => {
        if (!visited[p] && matches(p)) {
            visited[p] = 1;
            stack.push(p);
        }
    };
    for (let x = 0; x < w; x++) {
        seed(x);
        seed((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
        seed(y * w);
        seed(y * w + (w - 1));
    }
    let keyed = 0;
    while (stack.length) {
        const p = stack.pop();
        data[p * channels + 3] = 0;
        keyed++;
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0)
            seed(p - 1);
        if (x < w - 1)
            seed(p + 1);
        if (y > 0)
            seed(p - w);
        if (y < h - 1)
            seed(p + w);
    }
    const png = await (0, sharp_1.default)(data, { raw: { width: w, height: h, channels } }).png().toBuffer();
    return { png, keyedFraction: total > 0 ? keyed / total : 0, borderColor: key };
}
/** Promedio y desvío del color de la franja de borde (2px) de un RGBA raw. */
function borderStats(data, w, h, channels) {
    const sums = [0, 0, 0];
    const sqSums = [0, 0, 0];
    let n = 0;
    const band = 2;
    const at = (x, y) => (y * w + x) * channels;
    const add = (idx) => {
        for (let c = 0; c < 3; c++) {
            const v = data[idx + c] ?? 0;
            sums[c] = (sums[c] ?? 0) + v;
            sqSums[c] = (sqSums[c] ?? 0) + v * v;
        }
        n++;
    };
    for (let y = 0; y < h; y++) {
        for (let k = 0; k < band && k < w; k++) {
            add(at(k, y));
            add(at(w - 1 - k, y));
        }
    }
    for (let x = 0; x < w; x++) {
        for (let k = 0; k < band && k < h; k++) {
            add(at(x, k));
            add(at(x, h - 1 - k));
        }
    }
    if (n === 0)
        return { mean: { r: 255, g: 0, b: 255 }, maxStd: 255 };
    const mean = { r: (sums[0] ?? 0) / n, g: (sums[1] ?? 0) / n, b: (sums[2] ?? 0) / n };
    const stds = [0, 1, 2].map((c) => {
        const m = (sums[c] ?? 0) / n;
        return Math.sqrt(Math.max(0, (sqSums[c] ?? 0) / n - m * m));
    });
    return { mean, maxStd: Math.max(...stds) };
}
/** ¿La fracción keyeada corresponde a un recorte utilizable? */
function keyedFractionOk(f) {
    return f >= 0.05 && f <= 0.97;
}
/**
 * Extrae el producto con fondo transparente (PRD §8.1), en orden de fidelidad:
 *
 * 1. Alguna imagen del producto ya trae alpha real → recortar y reusar.
 * 2. Alguna imagen tiene fondo casi uniforme (la foto de catálogo centrada
 *    sobre blanco que todos los productos tienen) → flood-key directo, SIN
 *    llamar a IA. Es el camino más fiel: no hay recreación que pueda deformar
 *    el producto. Se prueban TODAS las candidatas en orden (la de fondo blanco
 *    puede no ser la principal).
 * 3. Fallback: recrear el producto sobre magenta sólido con el proveedor
 *    multimodal y flood-keyear ese fondo (el modelo no devuelve alpha real de
 *    forma confiable, pero sí coloca el producto sobre un color pedido).
 *
 * El flood fill sólo keyea píxeles CONECTADOS al borde: los colores parecidos
 * al fondo dentro del producto (p.ej. una pantalla rosa frente al chroma
 * magenta) no se perforan. Si nada produce un recorte utilizable, LANZA → la
 * propuesta queda en error (PRD §14).
 */
async function removeProductBackground(sources, config) {
    const tech = config.image_technical;
    const maxDim = Math.min(tech.max_dimension, 1200);
    const candidates = sources.filter(Boolean);
    if (candidates.length === 0) {
        throw new Error('El producto no tiene imágenes para extraer.');
    }
    // 1) + 2) Caminos fieles (sin IA), probando cada imagen candidata en orden.
    for (const source of candidates) {
        if (await hasRealAlpha(source)) {
            return encodeAlphaWebp(await trimTransparent(source), maxDim, tech.webp_quality);
        }
        const direct = await tryDirectExtraction(source);
        if (direct) {
            return encodeAlphaWebp(await trimTransparent(direct), maxDim, tech.webp_quality);
        }
    }
    // 3) Recreación sobre chroma magenta + flood key (referencia = la principal).
    const source = candidates[0];
    const dataUrl = (0, images_1.toDataUrl)(source, await mimeOf(source));
    const generated = await (0, openrouter_1.generateImage)({
        model: config.image_ai.model,
        prompt: REMOVE_BG_PROMPT,
        referenceImages: [dataUrl],
    });
    const { png, keyedFraction, borderColor } = await floodKeyToAlpha(generated.bytes, CHROMA_TOLERANCE);
    // Sanidad extra: el borde de lo generado tiene que ser magenta-ish; si no, el
    // modelo ignoró el pedido y el key habría borrado otra cosa.
    const isMagentaish = borderColor.r > 150 && borderColor.g < 110 && borderColor.b > 150;
    if (!isMagentaish || !keyedFractionOk(keyedFraction)) {
        throw new Error(keyedFraction > 0.97
            ? 'No se pudo remover el fondo del producto (no quedó producto visible tras el recorte).'
            : 'No se pudo remover el fondo del producto (el modelo no generó el fondo esperado).');
    }
    return encodeAlphaWebp(await trimTransparent(png), maxDim, tech.webp_quality);
}
/**
 * Recorte directo del ORIGINAL cuando su fondo es casi uniforme (borde con
 * desvío bajo): flood-key del color de borde. Devuelve null si el borde no es
 * uniforme o el resultado no es utilizable (se sigue con el fallback IA).
 */
async function tryDirectExtraction(source) {
    try {
        const { data, info } = await (0, sharp_1.default)(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const stats = borderStats(data, info.width, info.height, info.channels);
        if (stats.maxStd > DIRECT_MAX_BORDER_STD)
            return null;
        const { png, keyedFraction } = await floodKeyToAlpha(source, DIRECT_TOLERANCE);
        return keyedFractionOk(keyedFraction) ? png : null;
    }
    catch {
        return null;
    }
}
/**
 * Genera un fondo lifestyle SIN el producto (PRD §8.2). Reutiliza el proveedor
 * de imágenes existente; no manda imágenes de referencia (para que el producto
 * no se cuele en la escena) y reserva la zona inferior-derecha para componerlo
 * después. No se expone como operación en la interfaz.
 */
async function generateLifestyleBackground(config, productTitle) {
    const title = (productTitle || '').trim();
    const prompt = [
        'Create a realistic, high-quality lifestyle environment photograph suitable as a backdrop for showcasing a product',
        title ? ` such as "${title}"` : '',
        '. Professional commercial photography, soft natural lighting, appealing real-world context of use.',
        ' IMPORTANT: do NOT include the product itself, nor any packaging, boxes, bottles, labels or product-like objects — show ONLY the empty scene/environment.',
        ' Keep the BOTTOM-RIGHT area of the image visually clear and uncluttered (an empty surface) so a product can be composited there afterwards.',
        ' No text, no watermarks, no logos, no people.',
    ].join('');
    const generated = await (0, openrouter_1.generateImage)({ model: config.image_ai.model, prompt });
    return (0, images_1.optimizeToWebp)(generated.bytes, {
        quality: config.image_technical.webp_quality,
        maxKb: config.image_technical.max_kb,
        maxDimension: config.image_technical.max_dimension,
    });
}
/**
 * Compone el producto (con alpha) sobre el fondo según la composición (PRD §8.4).
 * `x`/`y` son el CENTRO del producto normalizado al fondo; `scale` = ancho del
 * producto / ancho del fondo. Soporta overflow parcial (el producto puede
 * sobresalir del borde) recortando la región visible. Exporta WebP con la
 * optimización técnica del Catalogador. No hay rotación, perspectiva ni sombras.
 */
async function renderEditableLifestyle(opts) {
    const tech = opts.config.image_technical;
    const c = clampComposition(opts.composition, opts.config.image_ai.editable_lifestyle_default_scale);
    const bgMeta = await (0, sharp_1.default)(opts.background).metadata();
    const W = bgMeta.width ?? 0;
    const H = bgMeta.height ?? 0;
    if (!W || !H)
        throw new Error('El fondo lifestyle es inválido.');
    const targetW = Math.max(1, Math.round(c.scale * W));
    const resized = await (0, sharp_1.default)(opts.product).resize({ width: targetW }).toBuffer({ resolveWithObject: true });
    const pw = resized.info.width;
    const ph = resized.info.height;
    let left = Math.round(c.x * W - pw / 2);
    let top = Math.round(c.y * H - ph / 2);
    // Recorte de overflow: sharp.composite exige offsets dentro del lienzo.
    let cropLeft = 0;
    let cropTop = 0;
    let cropW = pw;
    let cropH = ph;
    if (left < 0) {
        cropLeft = -left;
        cropW = pw + left;
        left = 0;
    }
    if (top < 0) {
        cropTop = -top;
        cropH = ph + top;
        top = 0;
    }
    if (left + cropW > W)
        cropW = W - left;
    if (top + cropH > H)
        cropH = H - top;
    // Nada visible (no debería pasar: el front y el clamp mantienen el centro
    // dentro del lienzo). Devuelve el fondo optimizado sin producto.
    if (cropW <= 0 || cropH <= 0) {
        return (0, images_1.optimizeToWebp)(opts.background, {
            quality: tech.webp_quality,
            maxKb: tech.max_kb,
            maxDimension: tech.max_dimension,
        });
    }
    let overlay = resized.data;
    if (cropLeft > 0 || cropTop > 0 || cropW !== pw || cropH !== ph) {
        overlay = await (0, sharp_1.default)(resized.data)
            .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
            .toBuffer();
    }
    const composed = await (0, sharp_1.default)(opts.background)
        .composite([{ input: overlay, left, top }])
        .png()
        .toBuffer();
    return (0, images_1.optimizeToWebp)(composed, {
        quality: tech.webp_quality,
        maxKb: tech.max_kb,
        maxDimension: tech.max_dimension,
    });
}
/**
 * Orquesta la generación editable para el pipeline (PRD §6.2): extrae el
 * producto, genera el fondo y compone un preview inicial determinístico. Cada
 * paso puede lanzar; el pipeline captura y marca la propuesta como error.
 */
async function buildEditableLifestyle(opts) {
    const product = await removeProductBackground(opts.references, opts.config);
    const background = await generateLifestyleBackground(opts.config, opts.productTitle);
    const composition = clampComposition({ ...exports.DEFAULT_EDITABLE_COMPOSITION, scale: opts.config.image_ai.editable_lifestyle_default_scale }, opts.config.image_ai.editable_lifestyle_default_scale);
    const preview = await renderEditableLifestyle({
        background: background.buffer,
        product: product.buffer,
        composition,
        config: opts.config,
    });
    return { product, background, preview, composition };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdGFibGUtbGlmZXN0eWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvY2F0YWxvZ2Fkb3IvYWkvZWRpdGFibGUtbGlmZXN0eWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQXNFQSw0Q0FNQztBQXdLRCwwREF3Q0M7QUF5QkQsa0VBaUJDO0FBU0QsMERBbUVDO0FBT0Qsd0RBbUJDO0FBNWFELGtEQUEwQjtBQUUxQiw2Q0FBNkM7QUFDN0MscUNBQTBFO0FBRTFFOzs7Ozs7Ozs7OztHQVdHO0FBRUgsNEVBQTRFO0FBQy9ELFFBQUEsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBQzFCLFFBQUEsa0JBQWtCLEdBQUcsR0FBRyxDQUFDO0FBc0J0Qzs7OztHQUlHO0FBQ1UsUUFBQSw0QkFBNEIsR0FBZ0IsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO0FBRTFGOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxDQUFDLGlEQUFpRDtBQUMvRSxNQUFNLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxDQUFDLDZDQUE2QztBQUMxRSxNQUFNLHFCQUFxQixHQUFHLEVBQUUsQ0FBQyxDQUFDLG9EQUFvRDtBQUV0RixNQUFNLGdCQUFnQixHQUNwQix5Z0JBQXlnQixDQUFDO0FBRTVnQixTQUFTLEtBQUssQ0FBQyxDQUFTLEVBQUUsR0FBVyxFQUFFLEdBQVc7SUFDaEQsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUFFLE9BQU8sR0FBRyxDQUFDO0lBQ2hDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBRUQsdUVBQXVFO0FBQ3ZFLFNBQWdC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QUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN2QyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3hCLENBQUM7SUFDSCxDQUFDO0lBQ0QsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzNCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3ZDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDZCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEIsQ0FBQztJQUNILENBQUM7SUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDO0lBQ3BFLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMs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