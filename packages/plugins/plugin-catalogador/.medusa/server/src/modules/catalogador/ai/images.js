"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NORMALIZE_MAX_SIDE = void 0;
exports.extensionForMime = extensionForMime;
exports.optimizeToWebp = optimizeToWebp;
exports.normalizeSquareWebp = normalizeSquareWebp;
exports.processTechnical = processTechnical;
exports.inspectImage = inspectImage;
exports.generateProductImage = generateProductImage;
exports.fetchImageBytes = fetchImageBytes;
exports.toDataUrl = toDataUrl;
const sharp_1 = __importDefault(require("sharp"));
const openrouter_1 = require("./openrouter");
const MIME_BY_FORMAT = {
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    png: 'image/png',
    avif: 'image/avif',
};
const EXT_BY_FORMAT = {
    webp: 'webp',
    jpeg: 'jpg',
    png: 'png',
    avif: 'avif',
};
/** Extensión de archivo para un mime de salida. WebP es el fallback seguro. */
function extensionForMime(mimeType) {
    for (const [format, mime] of Object.entries(MIME_BY_FORMAT)) {
        if (mime === mimeType)
            return EXT_BY_FORMAT[format];
    }
    return 'webp';
}
/**
 * Optimiza a WebP con loop de reducción de calidad hasta el peso objetivo
 * (portado de `optimizeImageToWebP`). No agranda por encima del original.
 */
async function optimizeToWebp(input, opts) {
    const startQ = Math.min(Math.max(Math.round(opts.quality), 40), 95);
    const encode = (q) => (0, sharp_1.default)(input)
        .rotate()
        .resize({ width: opts.maxDimension, height: opts.maxDimension, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: q, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    let { data, info } = await encode(startQ);
    let q = startQ;
    // Bajar de a 5 hasta cumplir el peso objetivo o llegar a 20.
    while (data.length > opts.maxKb * 1024 && q > 20) {
        q -= 5;
        const retry = await encode(q);
        data = retry.data;
        info = retry.info;
    }
    return {
        buffer: data,
        mimeType: 'image/webp',
        bytes: data.length,
        width: info.width,
        height: info.height,
    };
}
/**
 * Normaliza a un cuadrado uniforme sobre fondo blanco (contain + padding),
 * para que las fichas tengan márgenes/relación consistentes (portado de
 * `normalizeCatalogImageToPng`, adaptado a WebP).
 */
async function normalizeSquareWebp(input, opts) {
    const size = opts.size;
    const inner = Math.round(size * 0.8);
    const resized = await (0, sharp_1.default)(input)
        .rotate()
        .resize({ width: inner, height: inner, fit: 'inside', withoutEnlargement: true })
        .toBuffer();
    const data = await (0, sharp_1.default)({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
    })
        .composite([{ input: resized, gravity: 'centre' }])
        .flatten({ background: '#ffffff' })
        .webp({ quality: Math.min(Math.max(opts.quality, 40), 95), effort: 4 })
        .toBuffer({ resolveWithObject: true });
    return {
        buffer: data.data,
        mimeType: 'image/webp',
        bytes: data.data.length,
        width: data.info.width,
        height: data.info.height,
    };
}
/**
 * Lado máximo del lienzo de `normalize`. Se mantiene tal cual estaba (y no pasa a
 * ser `max_dimension`) por decisión explícita: el punto de normalizar es que todas
 * las fichas queden con la MISMA relación, y mover el lienzo cambia el encuadre de
 * todo el catálogo ya procesado.
 */
exports.NORMALIZE_MAX_SIDE = 1200;
/** Proporción del lienzo que ocupa el producto al normalizar. */
const NORMALIZE_INNER_RATIO = 0.8;
/** Piso del loop de compresión: por debajo la imagen deja de ser presentable. */
const MIN_COMPRESS_QUALITY = 20;
const clampQuality = (q) => Math.min(Math.max(Math.round(q), 40), 95);
/** Formato de origen, mapeado a lo que sabemos encodear. `null` = no soportado. */
async function detectFormat(input) {
    const format = (await (0, sharp_1.default)(input).metadata()).format;
    return format === 'webp' || format === 'jpeg' || format === 'png' || format === 'avif' ? format : null;
}
/**
 * Etapas de GEOMETRÍA (`resize` y `normalize`), aplicadas una sola vez y guardadas
 * como PNG intermedio.
 *
 * PNG y no el formato final a propósito: el intermedio es sin pérdida, así que el
 * loop de compresión puede re-encodear N veces desde acá sin acumular degradación.
 * Si no se pidió ninguna etapa de geometría se devuelve el buffer ORIGINAL sin
 * tocarlo — que es lo que hace que "sólo Comprimir" no reescale nada.
 */
async function applyGeometry(input, opts) {
    if (!opts.doResize && !opts.doNormalize)
        return input;
    if (opts.doNormalize) {
        const size = Math.min(opts.maxDimension, exports.NORMALIZE_MAX_SIDE);
        const inner = Math.round(size * NORMALIZE_INNER_RATIO);
        // Con `resize` también pedido, el contenido se acota a `max_dimension` antes de
        // entrar al lienzo; el lienzo sigue mandando el encuadre.
        const innerSide = opts.doResize ? Math.min(inner, opts.maxDimension) : inner;
        const resized = await (0, sharp_1.default)(input)
            .rotate()
            .resize({ width: innerSide, height: innerSide, fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
        return (0, sharp_1.default)({
            create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
        })
            .composite([{ input: resized, gravity: 'centre' }])
            .flatten({ background: '#ffffff' })
            .png()
            .toBuffer();
    }
    // Sólo resize: se preserva el canal alfa (PNG lo conserva).
    return (0, sharp_1.default)(input)
        .rotate()
        .resize({ width: opts.maxDimension, height: opts.maxDimension, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
}
/**
 * Procesamiento técnico COMPONIBLE: cada operación elegida es una etapa real e
 * independiente.
 *
 * Reemplaza al ternario `normalize ? normalizeSquareWebp : optimizeToWebp`, con el
 * que marcar "Redimensionar", "Comprimir" o "Convertir a WebP" daba byte por byte
 * el mismo resultado, y con el que "Comprimir" NO comprimía a `max_kb` en cuanto
 * "Normalizar" estaba tildado — que es el caso por defecto de la UI.
 *
 * Orden: resize → normalize → encode → loop de compresión. `to_webp` decide el
 * formato de salida; sin él se conserva el de origen.
 */
async function processTechnical(input, opts) {
    const ops = new Set(opts.ops);
    const doResize = ops.has('resize');
    const doNormalize = ops.has('normalize');
    const doWebp = ops.has('to_webp');
    const doCompress = ops.has('compress');
    const format = doWebp ? 'webp' : ((await detectFormat(input)) ?? 'webp');
    const geometry = await applyGeometry(input, { doResize, doNormalize, maxDimension: opts.maxDimension });
    const encode = (q) => {
        const pipe = (0, sharp_1.default)(geometry);
        switch (format) {
            case 'jpeg':
                // JPEG no tiene alfa y sin el flatten explícito sharp compone sobre NEGRO.
                // Hoy es DEFENSIVO: el formato sale del origen, y un JPEG de origen nunca
                // trae alfa (los que sí lo traen —png/webp/avif— conservan su formato). Se
                // deja porque el día que la elección de formato cambie, su ausencia se
                // manifestaría como fondos negros en el catálogo y no como un error.
                return pipe.flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true }).toBuffer({ resolveWithObject: true });
            case 'png':
                // `palette` es lo que hace que `quality` mueva el peso en PNG.
                return pipe.png({ quality: q, palette: true, compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
            case 'avif':
                return pipe.avif({ quality: q, effort: 4 }).toBuffer({ resolveWithObject: true });
            case 'webp':
            default:
                return pipe.webp({ quality: q, effort: 4 }).toBuffer({ resolveWithObject: true });
        }
    };
    let quality = clampQuality(opts.quality);
    let { data, info } = await encode(quality);
    let targetKbMissed = false;
    if (doCompress) {
        const targetBytes = opts.maxKb * 1024;
        while (data.length > targetBytes && quality > MIN_COMPRESS_QUALITY) {
            quality -= 5;
            const retry = await encode(quality);
            data = retry.data;
            info = retry.info;
        }
        if (data.length > targetBytes) {
            targetKbMissed = true;
            // Se avisa, como hace el gemelo de landing-page: quedarse corto en silencio es
            // indistinguible de no haber comprimido.
            console.warn(`[catalogador-image] ${format} quedó en ${Math.round(data.length / 1024)}KB ` +
                `(objetivo ${opts.maxKb}KB) con calidad ${quality}.`);
        }
    }
    return {
        buffer: data,
        mimeType: MIME_BY_FORMAT[format],
        bytes: data.length,
        width: info.width,
        height: info.height,
        format,
        quality,
        targetKbMissed,
    };
}
/** Métricas simples para detectar imágenes pesadas o de baja resolución. */
async function inspectImage(input) {
    const meta = await (0, sharp_1.default)(input).metadata();
    return { width: meta.width ?? 0, height: meta.height ?? 0, bytes: input.length };
}
function promptFor(kind, config, productTitle) {
    const ia = config.image_ai;
    const base = ia.base_prompt?.trim();
    const specific = kind === 'recreate'
        ? ia.recreate_prompt
        : kind === 'lifestyle'
            ? ia.lifestyle_prompt
            : kind === 'background'
                ? ia.background_prompt
                : kind === 'generate_missing'
                    ? ia.missing_prompt
                    : ia.recreate_prompt;
    // Defaults sensatos si Configuración no define prompts (PRD §22.2).
    const fallback = {
        recreate: 'Recreate this product photo on a pure #FFFFFF background, centered, 1:1, with at least 10% padding. Keep the real product and any printed branding faithful. Remove measurement arrows, spec tables, price tags and overlays. No crop.',
        lifestyle: 'Create a realistic lifestyle scene featuring this exact product in a natural, appealing context. Keep the product faithful to the reference photo (shape, color, branding). Professional e-commerce photography, soft lighting.',
        background: 'Place this exact product on the configured background. Keep the product faithful to the reference. Studio quality, 1:1.',
        generate_missing: 'Generate a clean product photo based on the product name and any reference, on a pure #FFFFFF background, centered, 1:1.',
        variation: 'Generate a subtle variation of this product image, keeping the product faithful. Pure white background, 1:1.',
    };
    const preserve = ia.preserve_product
        ? ' IMPORTANT: do not alter the product itself, its shape, colors or printed packaging.'
        : '';
    return [base, specific?.trim() || fallback[kind], `Product: ${productTitle}.`, preserve]
        .filter(Boolean)
        .join(' ');
}
/**
 * Genera una imagen mediante IA a partir de imágenes de referencia del producto.
 * Devuelve el buffer normalizado a cuadrado blanco. `referenceImages` son data
 * URLs de las fotos existentes (para mantener fiel el producto).
 */
async function generateProductImage(opts) {
    const { config } = opts;
    const prompt = promptFor(opts.kind, config, opts.productTitle);
    const generated = await (0, openrouter_1.generateImage)({
        model: config.image_ai.model,
        prompt,
        referenceImages: opts.referenceImages,
    });
    // Normaliza el resultado a un cuadrado blanco consistente (lifestyle no se
    // fuerza a fondo blanco: sólo se reescala a cuadrado si aplica).
    if (opts.kind === 'lifestyle' || opts.kind === 'background') {
        return optimizeToWebp(generated.bytes, {
            quality: config.image_technical.webp_quality,
            maxKb: config.image_technical.max_kb,
            maxDimension: config.image_technical.max_dimension,
        });
    }
    return normalizeSquareWebp(generated.bytes, {
        size: Math.min(config.image_technical.max_dimension, 1200),
        quality: config.image_technical.webp_quality,
    });
}
/** Descarga bytes de una imagen pública (para procesar/usar de referencia). */
async function fetchImageBytes(url, timeoutMs = 10000) {
    if (!/^https?:\/\//i.test(url))
        return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok)
            return null;
        return Buffer.from(await res.arrayBuffer());
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
function toDataUrl(buffer, mimeType) {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvY2F0YWxvZ2Fkb3IvYWkvaW1hZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQW9EQSw0Q0FLQztBQU1ELHdDQThCQztBQU9ELGtEQStCQztBQTJGRCw0Q0FtRUM7QUFHRCxvQ0FHQztBQTZDRCxvREEwQkM7QUFHRCwwQ0FhQztBQUVELDhCQUVDO0FBbFlELGtEQUEwQjtBQUUxQiw2Q0FBNkM7QUFzQjdDLE1BQU0sY0FBYyxHQUFpQztJQUNuRCxJQUFJLEVBQUUsWUFBWTtJQUNsQixJQUFJLEVBQUUsWUFBWTtJQUNsQixHQUFHLEVBQUUsV0FBVztJQUNoQixJQUFJLEVBQUUsWUFBWTtDQUNuQixDQUFDO0FBRUYsTUFBTSxhQUFhLEdBQWlDO0lBQ2xELElBQUksRUFBRSxNQUFNO0lBQ1osSUFBSSxFQUFFLEtBQUs7SUFDWCxHQUFHLEVBQUUsS0FBSztJQUNWLElBQUksRUFBRSxNQUFNO0NBQ2IsQ0FBQztBQWVGLCtFQUErRTtBQUMvRSxTQUFnQixnQkFBZ0IsQ0FBQyxRQUFnQjtJQUMvQyxLQUFLLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1FBQzVELElBQUksSUFBSSxLQUFLLFFBQVE7WUFBRSxPQUFPLGFBQWEsQ0FBQyxNQUFzQixDQUFDLENBQUM7SUFDdEUsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsY0FBYyxDQUNsQyxLQUFhLEVBQ2IsSUFBOEQ7SUFFOUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRXBFLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FDM0IsSUFBQSxlQUFLLEVBQUMsS0FBSyxDQUFDO1NBQ1QsTUFBTSxFQUFFO1NBQ1IsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQztTQUN4RyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztTQUMvQixRQUFRLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRTNDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDO0lBQ2YsNkRBQTZEO0lBQzdELE9BQU8sSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFDakQsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNQLE1BQU0sS0FBSyxHQUFHLE1BQU0sTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlCLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQ2xCLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLElBQUk7UUFDWixRQUFRLEVBQUUsWUFBWTtRQUN0QixLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU07UUFDbEIsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO1FBQ2pCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtLQUNwQixDQUFDO0FBQ0osQ0FBQztBQUVEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUsbUJBQW1CLENBQ3ZDLEtBQWEsRUFDYixJQUF1QztJQUV2QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3ZCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSxlQUFLLEVBQUMsS0FBSyxDQUFDO1NBQy9CLE1BQU0sRUFBRTtTQUNSLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxDQUFDO1NBQ2hGLFFBQVEsRUFBRSxDQUFDO0lBRWQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFBLGVBQUssRUFBQztRQUN2QixNQUFNLEVBQUU7WUFDTixLQUFLLEVBQUUsSUFBSTtZQUNYLE1BQU0sRUFBRSxJQUFJO1lBQ1osUUFBUSxFQUFFLENBQUM7WUFDWCxVQUFVLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFO1NBQ2pEO0tBQ0YsQ0FBQztTQUNDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztTQUNsRCxPQUFPLENBQUMsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLENBQUM7U0FDbEMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztTQUN0RSxRQUFRLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRXpDLE9BQU87UUFDTCxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDakIsUUFBUSxFQUFFLFlBQVk7UUFDdEIsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtRQUN2QixLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLO1FBQ3RCLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU07S0FDekIsQ0FBQztBQUNKLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNVLFFBQUEsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBRXZDLGlFQUFpRTtBQUNqRSxNQUFNLHFCQUFxQixHQUFHLEdBQUcsQ0FBQztBQUVsQyxpRkFBaUY7QUFDakYsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUM7QUFhaEMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBRTlFLG1GQUFtRjtBQUNuRixLQUFLLFVBQVUsWUFBWSxDQUFDLEtBQWE7SUFDdkMsTUFBTSxNQUFNLEdBQUcsQ0FBQyxNQUFNLElBQUEsZUFBSyxFQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDO0lBQ3RELE9BQU8sTUFBTSxLQUFLLE1BQU0sSUFBSSxNQUFNLEtBQUssTUFBTSxJQUFJLE1BQU0sS0FBSyxLQUFLLElBQUksTUFBTSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDekcsQ0FBQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsS0FBSyxVQUFVLGFBQWEsQ0FDMUIsS0FBYSxFQUNiLElBQXVFO0lBRXZFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVc7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUV0RCxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNyQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsMEJBQWtCLENBQUMsQ0FBQztRQUM3RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3ZELGdGQUFnRjtRQUNoRiwwREFBMEQ7UUFDMUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDN0UsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFBLGVBQUssRUFBQyxLQUFLLENBQUM7YUFDL0IsTUFBTSxFQUFFO2FBQ1IsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLENBQUM7YUFDeEYsR0FBRyxFQUFFO2FBQ0wsUUFBUSxFQUFFLENBQUM7UUFFZCxPQUFPLElBQUEsZUFBSyxFQUFDO1lBQ1gsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFO1NBQ3JHLENBQUM7YUFDQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7YUFDbEQsT0FBTyxDQUFDLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxDQUFDO2FBQ2xDLEdBQUcsRUFBRTthQUNMLFFBQVEsRUFBRSxDQUFDO0lBQ2hCLENBQUM7SUFFRCw0REFBNEQ7SUFDNUQsT0FBTyxJQUFBLGVBQUssRUFBQyxLQUFLLENBQUM7U0FDaEIsTUFBTSxFQUFFO1NBQ1IsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQztTQUN4RyxHQUFHLEVBQUU7U0FDTCxRQUFRLEVBQUUsQ0FBQztBQUNoQixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7O0dBV0c7QUFDSSxLQUFLLFVBQVUsZ0JBQWdCLENBQ3BDLEtBQWEsRUFDYixJQUFzRjtJQUV0RixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUIsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbEMsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUV2QyxNQUFNLE1BQU0sR0FBaUIsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZGLE1BQU0sUUFBUSxHQUFHLE1BQU0sYUFBYSxDQUFDLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0lBRXhHLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBUyxFQUFFLEVBQUU7UUFDM0IsTUFBTSxJQUFJLEdBQUcsSUFBQSxlQUFLLEVBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0IsUUFBUSxNQUFNLEVBQUUsQ0FBQztZQUNmLEtBQUssTUFBTTtnQkFDVCwyRUFBMkU7Z0JBQzNFLDBFQUEwRTtnQkFDMUUsMkVBQTJFO2dCQUMzRSx1RUFBdUU7Z0JBQ3ZFLHFFQUFxRTtnQkFDckUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzNILEtBQUssS0FBSztnQkFDUiwrREFBK0Q7Z0JBQy9ELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDNUcsS0FBSyxNQUFNO2dCQUNULE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNwRixLQUFLLE1BQU0sQ0FBQztZQUNaO2dCQUNFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN0RixDQUFDO0lBQ0gsQ0FBQyxDQUFDO0lBRUYsSUFBSSxPQUFPLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6QyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRTNDLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQztJQUMzQixJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDdEMsT0FBTyxJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsSUFBSSxPQUFPLEdBQUcsb0JBQW9CLEVBQUUsQ0FBQztZQUNuRSxPQUFPLElBQUksQ0FBQyxDQUFDO1lBQ2IsTUFBTSxLQUFLLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDcEMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDbEIsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDcEIsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLEVBQUUsQ0FBQztZQUM5QixjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLCtFQUErRTtZQUMvRSx5Q0FBeUM7WUFDekMsT0FBTyxDQUFDLElBQUksQ0FDVix1QkFBdUIsTUFBTSxhQUFhLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSztnQkFDM0UsYUFBYSxJQUFJLENBQUMsS0FBSyxtQkFBbUIsT0FBTyxHQUFHLENBQ3ZELENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU87UUFDTCxNQUFNLEVBQUUsSUFBSTtRQUNaLFFBQVEsRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDO1FBQ2hDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtRQUNsQixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7UUFDakIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1FBQ25CLE1BQU07UUFDTixPQUFPO1FBQ1AsY0FBYztLQUNmLENBQUM7QUFDSixDQUFDO0FBRUQsNEVBQTRFO0FBQ3JFLEtBQUssVUFBVSxZQUFZLENBQUMsS0FBYTtJQUM5QyxNQUFNLElBQUksR0FBRyxNQUFNLElBQUEsZUFBSyxFQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzNDLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDbkYsQ0FBQztBQUlELFNBQVMsU0FBUyxDQUFDLElBQWlCLEVBQUUsTUFBeUIsRUFBRSxZQUFvQjtJQUNuRixNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDO0lBQzNCLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDcEMsTUFBTSxRQUFRLEdBQ1osSUFBSSxLQUFLLFVBQVU7UUFDakIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxlQUFlO1FBQ3BCLENBQUMsQ0FBQyxJQUFJLEtBQUssV0FBVztZQUNwQixDQUFDLENBQUMsRUFBRSxDQUFDLGdCQUFnQjtZQUNyQixDQUFDLENBQUMsSUFBSSxLQUFLLFlBQVk7Z0JBQ3JCLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCO2dCQUN0QixDQUFDLENBQUMsSUFBSSxLQUFLLGtCQUFrQjtvQkFDM0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxjQUFjO29CQUNuQixDQUFDLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQztJQUUvQixvRUFBb0U7SUFDcEUsTUFBTSxRQUFRLEdBQWdDO1FBQzVDLFFBQVEsRUFDTix3T0FBd087UUFDMU8sU0FBUyxFQUNQLGlPQUFpTztRQUNuTyxVQUFVLEVBQ1IseUhBQXlIO1FBQzNILGdCQUFnQixFQUNkLDBIQUEwSDtRQUM1SCxTQUFTLEVBQUUsOEdBQThHO0tBQzFILENBQUM7SUFFRixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsZ0JBQWdCO1FBQ2xDLENBQUMsQ0FBQyxzRkFBc0Y7UUFDeEYsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUVQLE9BQU8sQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxZQUFZLFlBQVksR0FBRyxFQUFFLFFBQVEsQ0FBQztTQUNyRixNQUFNLENBQUMsT0FBTyxDQUFDO1NBQ2YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2YsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUsb0JBQW9CLENBQUMsSUFLMUM7SUFDQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBQ3hCLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDL0QsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFBLDBCQUFhLEVBQUM7UUFDcEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSztRQUM1QixNQUFNO1FBQ04sZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO0tBQ3RDLENBQUMsQ0FBQztJQUNILDJFQUEyRTtJQUMzRSxpRUFBaUU7SUFDakUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFdBQVcsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRSxDQUFDO1FBQzVELE9BQU8sY0FBYyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUU7WUFDckMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsWUFBWTtZQUM1QyxLQUFLLEVBQUUsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNO1lBQ3BDLFlBQVksRUFBRSxNQUFNLENBQUMsZUFBZSxDQUFDLGFBQWE7U0FDbkQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELE9BQU8sbUJBQW1CLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRTtRQUMxQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUM7UUFDMUQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsWUFBWTtLQUM3QyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsK0VBQStFO0FBQ3hFLEtBQUssVUFBVSxlQUFlLENBQUMsR0FBVyxFQUFFLFNBQVMsR0FBRyxLQUFLO0lBQ2xFLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQzVDLE1BQU0sVUFBVSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7SUFDekMsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUM5RCxJQUFJLENBQUM7UUFDSCxNQUFNLEdBQUcsR0FBRyxNQUFNLEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDNUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDekIsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztZQUFTLENBQUM7UUFDVCxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEIsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFnQixTQUFTLENBQUMsTUFBYyxFQUFFLFFBQWdCO0lBQ3hELE9BQU8sUUFBUSxRQUFRLFdBQVcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO0FBQ2hFLENBQUMifQ==