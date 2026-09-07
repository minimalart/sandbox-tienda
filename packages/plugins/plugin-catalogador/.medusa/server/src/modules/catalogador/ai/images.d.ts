import type { CatalogadorConfig } from '../config';
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
export declare function extensionForMime(mimeType: string): string;
/**
 * Optimiza a WebP con loop de reducción de calidad hasta el peso objetivo
 * (portado de `optimizeImageToWebP`). No agranda por encima del original.
 */
export declare function optimizeToWebp(input: Buffer, opts: {
    quality: number;
    maxKb: number;
    maxDimension: number;
}): Promise<ProcessedImage>;
/**
 * Normaliza a un cuadrado uniforme sobre fondo blanco (contain + padding),
 * para que las fichas tengan márgenes/relación consistentes (portado de
 * `normalizeCatalogImageToPng`, adaptado a WebP).
 */
export declare function normalizeSquareWebp(input: Buffer, opts: {
    size: number;
    quality: number;
}): Promise<ProcessedImage>;
/**
 * Lado máximo del lienzo de `normalize`. Se mantiene tal cual estaba (y no pasa a
 * ser `max_dimension`) por decisión explícita: el punto de normalizar es que todas
 * las fichas queden con la MISMA relación, y mover el lienzo cambia el encuadre de
 * todo el catálogo ya procesado.
 */
export declare const NORMALIZE_MAX_SIDE = 1200;
export type TechnicalOp = 'to_webp' | 'compress' | 'resize' | 'normalize';
export type TechnicalResult = ProcessedImage & {
    /** Formato realmente emitido (útil para la metadata de la propuesta). */
    format: OutputFormat;
    /** Calidad con la que se emitió (la última del loop, si hubo). */
    quality: number;
    /** `compress` pedido pero `max_kb` inalcanzable incluso en el piso de calidad. */
    targetKbMissed: boolean;
};
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
export declare function processTechnical(input: Buffer, opts: {
    ops: readonly string[];
    quality: number;
    maxKb: number;
    maxDimension: number;
}): Promise<TechnicalResult>;
/** Métricas simples para detectar imágenes pesadas o de baja resolución. */
export declare function inspectImage(input: Buffer): Promise<{
    width: number;
    height: number;
    bytes: number;
}>;
export type ImageAiKind = 'recreate' | 'lifestyle' | 'background' | 'generate_missing' | 'variation';
/**
 * Genera una imagen mediante IA a partir de imágenes de referencia del producto.
 * Devuelve el buffer normalizado a cuadrado blanco. `referenceImages` son data
 * URLs de las fotos existentes (para mantener fiel el producto).
 */
export declare function generateProductImage(opts: {
    config: CatalogadorConfig;
    kind: ImageAiKind;
    productTitle: string;
    referenceImages: string[];
}): Promise<ProcessedImage>;
/** Descarga bytes de una imagen pública (para procesar/usar de referencia). */
export declare function fetchImageBytes(url: string, timeoutMs?: number): Promise<Buffer | null>;
export declare function toDataUrl(buffer: Buffer, mimeType: string): string;
