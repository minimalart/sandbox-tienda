import sharp from 'sharp';
import type { CatalogadorConfig } from '../config';
import { generateImage } from './openrouter';
import { optimizeToWebp, toDataUrl, type ProcessedImage } from './images';

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
export const EDITABLE_MIN_SCALE = 0.08;
export const EDITABLE_MAX_SCALE = 0.7;

/** Composición normalizada 0-1 (PRD §8.3/§9.1). `x`/`y` = CENTRO del producto. */
export type Composition = { x: number; y: number; scale: number };

/** Metadata mínima persistida en `cataloging_asset_proposal.metadata` (PRD §9.1). */
export type EditableLifestyleMetadata = {
  version: 1;
  background: { url: string; file_id?: string };
  product_layer: { url: string; file_id?: string; source_url: string };
  /**
   * Preview inicial. Vive en su propio campo porque al aplicar
   * `generated_asset_id` pasa a apuntar al render final: sin esto, la referencia al
   * archivo del preview se pierde de la base y el binario queda huérfano en el
   * storage para siempre. Opcional para no romper las propuestas ya persistidas.
   */
  preview?: { url: string; file_id?: string };
  composition: Composition;
  initial_composition: Composition;
  final_render?: { url: string; file_id?: string };
};

/**
 * Composición inicial determinística (PRD §8.3): esquina inferior-derecha, que
 * es la zona que el prompt del fondo reserva libre. La escala inicial la fija
 * la config; la posición se mantiene como constante interna en el MVP.
 */
export const DEFAULT_EDITABLE_COMPOSITION: Composition = { x: 0.7, y: 0.75, scale: 0.25 };

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

const REMOVE_BG_PROMPT =
  'Recreate ONLY the main product from this photo, perfectly faithful to the original (exact same shape, colors, proportions and printed branding), centered and fully visible, and place it on a PERFECTLY UNIFORM solid pure magenta background of EXACT color #FF00FF (RGB 255,0,255). The background must be a single flat solid magenta filling the entire frame, with NO gradient, NO shadow, NO reflection, NO vignette and NO other objects. Do not add any text. Everything that is not the product must be pure #FF00FF magenta.';

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/** Aplica los límites del PRD §14 (x/y ∈ [0,1], scale ∈ [MIN,MAX]). */
export function clampComposition(c: Partial<Composition>, defaultScale = DEFAULT_EDITABLE_COMPOSITION.scale): Composition {
  return {
    x: clamp(typeof c.x === 'number' ? c.x : DEFAULT_EDITABLE_COMPOSITION.x, 0, 1),
    y: clamp(typeof c.y === 'number' ? c.y : DEFAULT_EDITABLE_COMPOSITION.y, 0, 1),
    scale: clamp(typeof c.scale === 'number' ? c.scale : defaultScale, EDITABLE_MIN_SCALE, EDITABLE_MAX_SCALE),
  };
}

/** ¿El buffer tiene transparencia REAL (no sólo un canal alpha todo opaco)? */
async function hasRealAlpha(buffer: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.hasAlpha) return false;
    const stats = await sharp(buffer).stats();
    return !stats.isOpaque;
  } catch {
    return false;
  }
}

async function mimeOf(buffer: Buffer): Promise<string> {
  try {
    const fmt = (await sharp(buffer).metadata()).format;
    return fmt ? `image/${fmt === 'jpg' ? 'jpeg' : fmt}` : 'image/png';
  } catch {
    return 'image/png';
  }
}

/** Recorta márgenes transparentes excesivos; tolera imágenes uniformes. */
async function trimTransparent(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer).trim().toBuffer();
  } catch {
    return buffer;
  }
}

/** Codifica preservando el canal alpha (para la capa del producto). */
async function encodeAlphaWebp(input: Buffer, maxDimension: number, quality: number): Promise<ProcessedImage> {
  const { data, info } = await sharp(input)
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
async function floodKeyToAlpha(
  buffer: Buffer,
  tolerance: number
): Promise<{ png: Buffer; keyedFraction: number; borderColor: { r: number; g: number; b: number } }> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels; // 4 tras ensureAlpha
  const w = info.width;
  const h = info.height;
  const total = w * h;

  // El color de fondo real se toma del borde (tolera drift del chroma pedido).
  const key = borderStats(data, w, h, channels).mean;
  const tol2 = tolerance * tolerance;
  const matches = (p: number): boolean => {
    const i = p * channels;
    const dr = (data[i] ?? 0) - key.r;
    const dg = (data[i + 1] ?? 0) - key.g;
    const db = (data[i + 2] ?? 0) - key.b;
    return dr * dr + dg * dg + db * db <= tol2;
  };

  const visited = new Uint8Array(total);
  const stack: number[] = [];
  const seed = (p: number) => {
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
    const p = stack.pop() as number;
    data[p * channels + 3] = 0;
    keyed++;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }

  const png = await sharp(data, { raw: { width: w, height: h, channels } }).png().toBuffer();
  return { png, keyedFraction: total > 0 ? keyed / total : 0, borderColor: key };
}

/** Promedio y desvío del color de la franja de borde (2px) de un RGBA raw. */
function borderStats(
  data: Buffer,
  w: number,
  h: number,
  channels: number
): { mean: { r: number; g: number; b: number }; maxStd: number } {
  const sums = [0, 0, 0];
  const sqSums = [0, 0, 0];
  let n = 0;
  const band = 2;
  const at = (x: number, y: number) => (y * w + x) * channels;
  const add = (idx: number) => {
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
  if (n === 0) return { mean: { r: 255, g: 0, b: 255 }, maxStd: 255 };
  const mean = { r: (sums[0] ?? 0) / n, g: (sums[1] ?? 0) / n, b: (sums[2] ?? 0) / n };
  const stds = [0, 1, 2].map((c) => {
    const m = (sums[c] ?? 0) / n;
    return Math.sqrt(Math.max(0, (sqSums[c] ?? 0) / n - m * m));
  });
  return { mean, maxStd: Math.max(...stds) };
}

/** ¿La fracción keyeada corresponde a un recorte utilizable? */
function keyedFractionOk(f: number): boolean {
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
export async function removeProductBackground(sources: Buffer[], config: CatalogadorConfig): Promise<ProcessedImage> {
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
  const source = candidates[0] as Buffer;
  const dataUrl = toDataUrl(source, await mimeOf(source));
  const generated = await generateImage({
    model: config.image_ai.model,
    prompt: REMOVE_BG_PROMPT,
    referenceImages: [dataUrl],
  });

  const { png, keyedFraction, borderColor } = await floodKeyToAlpha(generated.bytes, CHROMA_TOLERANCE);
  // Sanidad extra: el borde de lo generado tiene que ser magenta-ish; si no, el
  // modelo ignoró el pedido y el key habría borrado otra cosa.
  const isMagentaish = borderColor.r > 150 && borderColor.g < 110 && borderColor.b > 150;
  if (!isMagentaish || !keyedFractionOk(keyedFraction)) {
    throw new Error(
      keyedFraction > 0.97
        ? 'No se pudo remover el fondo del producto (no quedó producto visible tras el recorte).'
        : 'No se pudo remover el fondo del producto (el modelo no generó el fondo esperado).'
    );
  }
  return encodeAlphaWebp(await trimTransparent(png), maxDim, tech.webp_quality);
}

/**
 * Recorte directo del ORIGINAL cuando su fondo es casi uniforme (borde con
 * desvío bajo): flood-key del color de borde. Devuelve null si el borde no es
 * uniforme o el resultado no es utilizable (se sigue con el fallback IA).
 */
async function tryDirectExtraction(source: Buffer): Promise<Buffer | null> {
  try {
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const stats = borderStats(data, info.width, info.height, info.channels);
    if (stats.maxStd > DIRECT_MAX_BORDER_STD) return null;
    const { png, keyedFraction } = await floodKeyToAlpha(source, DIRECT_TOLERANCE);
    return keyedFractionOk(keyedFraction) ? png : null;
  } catch {
    return null;
  }
}

/**
 * Genera un fondo lifestyle SIN el producto (PRD §8.2). Reutiliza el proveedor
 * de imágenes existente; no manda imágenes de referencia (para que el producto
 * no se cuele en la escena) y reserva la zona inferior-derecha para componerlo
 * después. No se expone como operación en la interfaz.
 */
export async function generateLifestyleBackground(config: CatalogadorConfig, productTitle: string): Promise<ProcessedImage> {
  const title = (productTitle || '').trim();
  const prompt = [
    'Create a realistic, high-quality lifestyle environment photograph suitable as a backdrop for showcasing a product',
    title ? ` such as "${title}"` : '',
    '. Professional commercial photography, soft natural lighting, appealing real-world context of use.',
    ' IMPORTANT: do NOT include the product itself, nor any packaging, boxes, bottles, labels or product-like objects — show ONLY the empty scene/environment.',
    ' Keep the BOTTOM-RIGHT area of the image visually clear and uncluttered (an empty surface) so a product can be composited there afterwards.',
    ' No text, no watermarks, no logos, no people.',
  ].join('');

  const generated = await generateImage({ model: config.image_ai.model, prompt });
  return optimizeToWebp(generated.bytes, {
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
export async function renderEditableLifestyle(opts: {
  background: Buffer;
  product: Buffer;
  composition: Composition;
  config: CatalogadorConfig;
}): Promise<ProcessedImage> {
  const tech = opts.config.image_technical;
  const c = clampComposition(opts.composition, opts.config.image_ai.editable_lifestyle_default_scale);

  const bgMeta = await sharp(opts.background).metadata();
  const W = bgMeta.width ?? 0;
  const H = bgMeta.height ?? 0;
  if (!W || !H) throw new Error('El fondo lifestyle es inválido.');

  const targetW = Math.max(1, Math.round(c.scale * W));
  const resized = await sharp(opts.product).resize({ width: targetW }).toBuffer({ resolveWithObject: true });
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
  if (left + cropW > W) cropW = W - left;
  if (top + cropH > H) cropH = H - top;

  // Nada visible (no debería pasar: el front y el clamp mantienen el centro
  // dentro del lienzo). Devuelve el fondo optimizado sin producto.
  if (cropW <= 0 || cropH <= 0) {
    return optimizeToWebp(opts.background, {
      quality: tech.webp_quality,
      maxKb: tech.max_kb,
      maxDimension: tech.max_dimension,
    });
  }

  let overlay = resized.data;
  if (cropLeft > 0 || cropTop > 0 || cropW !== pw || cropH !== ph) {
    overlay = await sharp(resized.data)
      .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
      .toBuffer();
  }

  const composed = await sharp(opts.background)
    .composite([{ input: overlay, left, top }])
    .png()
    .toBuffer();

  return optimizeToWebp(composed, {
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
export async function buildEditableLifestyle(opts: {
  config: CatalogadorConfig;
  productTitle: string;
  /** Imágenes candidatas del producto, en orden de preferencia (principal primero). */
  references: Buffer[];
}): Promise<{ product: ProcessedImage; background: ProcessedImage; preview: ProcessedImage; composition: Composition }> {
  const product = await removeProductBackground(opts.references, opts.config);
  const background = await generateLifestyleBackground(opts.config, opts.productTitle);
  const composition = clampComposition(
    { ...DEFAULT_EDITABLE_COMPOSITION, scale: opts.config.image_ai.editable_lifestyle_default_scale },
    opts.config.image_ai.editable_lifestyle_default_scale
  );
  const preview = await renderEditableLifestyle({
    background: background.buffer,
    product: product.buffer,
    composition,
    config: opts.config,
  });
  return { product, background, preview, composition };
}
