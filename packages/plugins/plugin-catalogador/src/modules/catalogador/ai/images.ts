import sharp from 'sharp';
import type { CatalogadorConfig } from '../config';
import { generateImage } from './openrouter';

/**
 * Pipeline de imágenes del Catalogador. Combina:
 *  - Procesamiento técnico DETERMINÍSTICO (WebP, compresión ≤ objetivo KB,
 *    resize, normalización cuadrada sobre fondo blanco) — portado y unificado
 *    desde selectio-ia-tool (`lib/image-processor.ts`).
 *  - Generación/recreación mediante IA (recreación fondo blanco, lifestyle,
 *    fondo configurado, imagen faltante, variaciones) — reutiliza el mismo
 *    proveedor multimodal (nano-banana) vía el cliente self-contained.
 *
 * NUNCA borra ni reemplaza el original: sólo produce buffers nuevos que el flujo
 * de aplicación adjunta como imágenes adicionales tras la aprobación (PRD §12).
 */

/**
 * Formatos que el procesamiento técnico sabe encodear. El resto (gif, svg, tiff,
 * heif) se convierte a WebP: son casos donde "conservar el formato de origen" no
 * tiene sentido para una ficha de catálogo.
 */
export type OutputFormat = 'webp' | 'jpeg' | 'png' | 'avif';

const MIME_BY_FORMAT: Record<OutputFormat, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
  avif: 'image/avif',
};

const EXT_BY_FORMAT: Record<OutputFormat, string> = {
  webp: 'webp',
  jpeg: 'jpg',
  png: 'png',
  avif: 'avif',
};

/**
 * `mimeType` es `string` y no `'image/webp'`: desde que "Convertir a WebP" es una
 * operación que se puede NO elegir, la salida del camino técnico puede conservar el
 * formato de origen. Los productores del camino IA siguen devolviendo webp.
 */
export type ProcessedImage = {
  buffer: Buffer;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
};

/** Extensión de archivo para un mime de salida. WebP es el fallback seguro. */
export function extensionForMime(mimeType: string): string {
  for (const [format, mime] of Object.entries(MIME_BY_FORMAT)) {
    if (mime === mimeType) return EXT_BY_FORMAT[format as OutputFormat];
  }
  return 'webp';
}

/**
 * Optimiza a WebP con loop de reducción de calidad hasta el peso objetivo
 * (portado de `optimizeImageToWebP`). No agranda por encima del original.
 */
export async function optimizeToWebp(
  input: Buffer,
  opts: { quality: number; maxKb: number; maxDimension: number }
): Promise<ProcessedImage> {
  const startQ = Math.min(Math.max(Math.round(opts.quality), 40), 95);

  const encode = (q: number) =>
    sharp(input)
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
export async function normalizeSquareWebp(
  input: Buffer,
  opts: { size: number; quality: number }
): Promise<ProcessedImage> {
  const size = opts.size;
  const inner = Math.round(size * 0.8);
  const resized = await sharp(input)
    .rotate()
    .resize({ width: inner, height: inner, fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  const data = await sharp({
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
export const NORMALIZE_MAX_SIDE = 1200;

/** Proporción del lienzo que ocupa el producto al normalizar. */
const NORMALIZE_INNER_RATIO = 0.8;

/** Piso del loop de compresión: por debajo la imagen deja de ser presentable. */
const MIN_COMPRESS_QUALITY = 20;

export type TechnicalOp = 'to_webp' | 'compress' | 'resize' | 'normalize';

export type TechnicalResult = ProcessedImage & {
  /** Formato realmente emitido (útil para la metadata de la propuesta). */
  format: OutputFormat;
  /** Calidad con la que se emitió (la última del loop, si hubo). */
  quality: number;
  /** `compress` pedido pero `max_kb` inalcanzable incluso en el piso de calidad. */
  targetKbMissed: boolean;
};

const clampQuality = (q: number) => Math.min(Math.max(Math.round(q), 40), 95);

/** Formato de origen, mapeado a lo que sabemos encodear. `null` = no soportado. */
async function detectFormat(input: Buffer): Promise<OutputFormat | null> {
  const format = (await sharp(input).metadata()).format;
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
async function applyGeometry(
  input: Buffer,
  opts: { doResize: boolean; doNormalize: boolean; maxDimension: number }
): Promise<Buffer> {
  if (!opts.doResize && !opts.doNormalize) return input;

  if (opts.doNormalize) {
    const size = Math.min(opts.maxDimension, NORMALIZE_MAX_SIDE);
    const inner = Math.round(size * NORMALIZE_INNER_RATIO);
    // Con `resize` también pedido, el contenido se acota a `max_dimension` antes de
    // entrar al lienzo; el lienzo sigue mandando el encuadre.
    const innerSide = opts.doResize ? Math.min(inner, opts.maxDimension) : inner;
    const resized = await sharp(input)
      .rotate()
      .resize({ width: innerSide, height: innerSide, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    return sharp({
      create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{ input: resized, gravity: 'centre' }])
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
  }

  // Sólo resize: se preserva el canal alfa (PNG lo conserva).
  return sharp(input)
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
export async function processTechnical(
  input: Buffer,
  opts: { ops: readonly string[]; quality: number; maxKb: number; maxDimension: number }
): Promise<TechnicalResult> {
  const ops = new Set(opts.ops);
  const doResize = ops.has('resize');
  const doNormalize = ops.has('normalize');
  const doWebp = ops.has('to_webp');
  const doCompress = ops.has('compress');

  const format: OutputFormat = doWebp ? 'webp' : ((await detectFormat(input)) ?? 'webp');
  const geometry = await applyGeometry(input, { doResize, doNormalize, maxDimension: opts.maxDimension });

  const encode = (q: number) => {
    const pipe = sharp(geometry);
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
      console.warn(
        `[catalogador-image] ${format} quedó en ${Math.round(data.length / 1024)}KB ` +
          `(objetivo ${opts.maxKb}KB) con calidad ${quality}.`
      );
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
export async function inspectImage(input: Buffer): Promise<{ width: number; height: number; bytes: number }> {
  const meta = await sharp(input).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0, bytes: input.length };
}

export type ImageAiKind = 'recreate' | 'lifestyle' | 'background' | 'generate_missing' | 'variation';

function promptFor(kind: ImageAiKind, config: CatalogadorConfig, productTitle: string): string {
  const ia = config.image_ai;
  const base = ia.base_prompt?.trim();
  const specific =
    kind === 'recreate'
      ? ia.recreate_prompt
      : kind === 'lifestyle'
        ? ia.lifestyle_prompt
        : kind === 'background'
          ? ia.background_prompt
          : kind === 'generate_missing'
            ? ia.missing_prompt
            : ia.recreate_prompt;

  // Defaults sensatos si Configuración no define prompts (PRD §22.2).
  const fallback: Record<ImageAiKind, string> = {
    recreate:
      'Recreate this product photo on a pure #FFFFFF background, centered, 1:1, with at least 10% padding. Keep the real product and any printed branding faithful. Remove measurement arrows, spec tables, price tags and overlays. No crop.',
    lifestyle:
      'Create a realistic lifestyle scene featuring this exact product in a natural, appealing context. Keep the product faithful to the reference photo (shape, color, branding). Professional e-commerce photography, soft lighting.',
    background:
      'Place this exact product on the configured background. Keep the product faithful to the reference. Studio quality, 1:1.',
    generate_missing:
      'Generate a clean product photo based on the product name and any reference, on a pure #FFFFFF background, centered, 1:1.',
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
export async function generateProductImage(opts: {
  config: CatalogadorConfig;
  kind: ImageAiKind;
  productTitle: string;
  referenceImages: string[];
}): Promise<ProcessedImage> {
  const { config } = opts;
  const prompt = promptFor(opts.kind, config, opts.productTitle);
  const generated = await generateImage({
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
export async function fetchImageBytes(url: string, timeoutMs = 10000): Promise<Buffer | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
