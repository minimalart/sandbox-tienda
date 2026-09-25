import sharp from 'sharp';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { truncateError } from '../sanitize';
import { ErpAuthError, ErpNonRetryableError, type AdapterContext, type ErpAdapter } from '../adapters/types';
import { imageFilename, type ProductImagePlan, type ProductImageState } from './plan-product-images';

/**
 * Lado de LECTURA y ESCRITURA de la fase de imágenes. La decisión de a quién
 * pedirle foto la toma `planProductImages` (pura); acá se baja del ERP, se sube
 * al File module y se escribe en el producto.
 *
 * Tres cosas que no son obvias y que costaron la primera importación real
 * (1.669 imágenes, 213,8 MB):
 *
 *  1. **Se baja y se re-sube, no se hotlinkea.** El endpoint de imágenes de Zeus
 *     exige el `Authorization: Bearer` y también acepta el JWT por query param,
 *     así que técnicamente se podría linkear directo desde el storefront y
 *     ahorrar toda la transferencia. No se hace: ese token lee el catálogo, crea
 *     clientes y crea pedidos, y una URL de producto es pública. El día que haga
 *     falta, el camino sano es una API key de Zeus restringida a imágenes.
 *  2. **Aislamiento por producto.** La primera corrida murió a las 327 imágenes
 *     porque un `ECONNRESET` se escapó del worker y rechazó el `Promise.all`. Acá
 *     cada artículo tiene su try/catch y sus reintentos con backoff; un fallo
 *     suelto es un warning, no el final de la fase.
 *  3. **Concurrencia acotada.** Cuatro en paralelo. No es un número mágico: es lo
 *     que no le mueve el amperímetro a producción mientras baja cientos de MB.
 *
 * Va por el módulo de producto y no por `updateProductsWorkflow` por la misma
 * razón que el resto del motor: el workflow emite `product.updated` por producto
 * y eso dispara un reindex de Typesense por producto. El motor emite UN evento
 * batcheado al final con `touchedProductIds`.
 */

const READ_CHUNK = 200;
/** Descargas simultáneas contra el ERP. */
const CONCURRENCY = 4;
/** Intentos por artículo ante error de red/servidor (el primero incluido). */
const MAX_ATTEMPTS = 3;
/** Base del backoff entre reintentos, en ms (200, 400, 800…). */
const RETRY_BASE_MS = 200;
/** Cada cuántos artículos se toca el log de sync (guard anti-stale + progreso). */
const PROGRESS_EVERY = 50;
/**
 * Fallos consecutivos sin UN solo éxito que abortan la fase. Mismo criterio que
 * `apply-color-option`: si los primeros intentos fallan todos, el supuesto está
 * mal (endpoint caído, JWT sin permiso de imágenes) y seguir 2.500 veces solo
 * suma ruido y transferencia.
 */
const ABORT_AFTER_CONSECUTIVE_FAILURES = 15;
/**
 * Lado menor mínimo, en píxeles, para que una foto del ERP entre al catálogo.
 *
 * EL CASO REAL. En desdeelsur el storefront pide hasta 800 px de ancho
 * (`thumbnail/index.tsx`) y pinta con `fill` + `object-contain`, así que el CSS
 * estira el archivo hasta llenar la card. Zeus devolvió fotos de 160×160 para
 * varios artículos de la línea Satinol: entraron sin chistar, se ampliaron 2-5×
 * y se vieron pixeladas en el listado y en el detalle. Auditado el 2026-08-27:
 * 492 de 2.292 productos con imagen tenían el lado menor por debajo de 600 px,
 * 53 de ellos por debajo de 200.
 *
 * POR QUÉ 500 Y NO 800. El umbral no filtra "lo que se ve perfecto" sino "lo que
 * se ve roto". Una foto de 600 px estirada a 800 pierde nitidez pero se lee; una
 * de 160 es un mosaico. Cortar en 800 dejaría sin imagen a cientos de artículos
 * que hoy se ven aceptables, y un placeholder gris no es mejor que una foto
 * mediocre. Por eso es un default conservador y `min_dimension_px` lo ajusta por
 * cliente.
 *
 * POR QUÉ NO ES UN `failed`. Una foto chica no mejora reintentando: no toca
 * `consecutiveFailures` y no dispara el corte por fallos consecutivos. Si Zeus
 * devolviera 15 fotos chicas seguidas, contarlas como fallo abortaría la fase
 * entera — exactamente el deadlock que arregló `image-failures.ts`.
 */
const DEFAULT_MIN_IMAGE_DIMENSION_PX = 500;

type FileWriter = {
  createFiles(
    files: Array<{ filename: string; mimeType: string; content: string; access: string }>
  ): Promise<Array<{ id: string; url: string }>>;
};

type ProductWriter = {
  upsertProducts(data: Array<Record<string, unknown>>): Promise<unknown>;
};

export type ProductImageApplyResult = {
  /** Productos que quedaron con imagen nueva. */
  imported: number;
  /** El ERP no tiene foto de ese artículo. No es un fallo. */
  without_image: number;
  /** Fallos reales (red, upload, escritura), ya agotados los reintentos. */
  failed: number;
  /**
   * El ERP tiene foto del artículo pero es demasiado chica para el storefront.
   * No es un fallo —no mejora reintentando— pero tampoco un `without_image`: el
   * ERP SÍ la tiene, y la acción correctiva es cargar una mejor allá.
   */
  too_small: number;
  /** Bytes descargados, para dimensionar la corrida en el log. */
  bytes: number;
  /** La fase se cortó por fallos consecutivos: quedó trabajo sin intentar. */
  aborted: boolean;
  errors: string[];
  touchedProductIds: Set<string>;
  /**
   * Códigos que fallaron con los reintentos agotados, para que el motor los
   * anote y la próxima corrida no vuelva a morir en el mismo bloque. Es la lista
   * completa, no los primeros diez como `errors`. Ver `image-failures.ts`.
   */
  failedCodes: string[];
  /** Códigos que importaron bien: se les borra el historial de fallos. */
  importedCodes: string[];
  /**
   * Códigos descartados por resolución. Van al mismo registro de fallos que los
   * de red: sin eso el planner los ve sin imagen y la fase se los vuelve a bajar
   * cada 15 minutos para descartarlos de nuevo. El cooldown de 7 días alcanza
   * para que una foto recargada en el ERP se reintente sola.
   */
  tooSmallCodes: string[];
};

/**
 * Estado de imagen de los productos que matchean los códigos del ERP.
 *
 * Se leen `thumbnail` e `images.id` y NADA más: la fase recorre el catálogo
 * completo en el backfill, y traer título y descripción de miles de artículos es
 * lo que ya volteó la caja de 2 GB en otros barridos.
 */
export async function readProductImageState(
  container: MedusaContainer,
  codes: string[]
): Promise<ProductImageState[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const out: ProductImageState[] = [];
  if (!codes.length) return out;

  type Row = {
    sku: string | null;
    product_id: string | null;
    product?: {
      id: string;
      thumbnail: string | null;
      images?: Array<{ id: string }> | null;
    } | null;
  };

  const seenCodes = new Set<string>();
  for (let i = 0; i < codes.length; i += READ_CHUNK) {
    const chunk = codes.slice(i, i + READ_CHUNK);
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: ['sku', 'product_id', 'product.id', 'product.thumbnail', 'product.images.id'],
      filters: { sku: chunk },
    })) as { data: Row[] };

    for (const variant of variants) {
      const sku = variant.sku?.trim();
      if (!sku || seenCodes.has(sku)) continue;
      const productId = variant.product?.id ?? variant.product_id;
      if (!productId) continue;
      seenCodes.add(sku);
      out.push({
        code: sku,
        product_id: productId,
        has_thumbnail: Boolean(variant.product?.thumbnail?.trim()),
        has_images: (variant.product?.images ?? []).length > 0,
      });
    }
  }
  return out;
}

/** Alto y ancho en píxeles de una imagen ya descargada. */
export type ImageDimensions = { width: number; height: number };

/**
 * Lee alto y ancho de los bytes de una imagen. Devuelve `null` si el formato no
 * se reconoce.
 *
 * `sharp` lee la CABECERA, no descomprime el bitmap: sobre un JPEG de 1512×1512
 * es del orden del microsegundo y no compite con la descarga. Un formato que no
 * entiende no bloquea nada — sin dimensiones no hay veredicto, y sin veredicto
 * la imagen pasa: el gate está para frenar lo que se MIDE mal, no lo que no se
 * puede medir.
 */
export async function readImageDimensions(content: Buffer): Promise<ImageDimensions | null> {
  try {
    const { width, height } = await sharp(content).metadata();
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}

/**
 * ¿La imagen es demasiado chica para el storefront?
 *
 * Se mira el LADO MENOR y no el área ni el ancho: la card es cuadrada o vertical
 * y el CSS estira hasta llenarla, así que una foto de 1600×150 se ve tan rota
 * como una de 150×150. Sin dimensiones legibles, pasa (ver `readImageDimensions`).
 */
export function isImageTooSmall(
  dimensions: ImageDimensions | null,
  minDimensionPx: number
): boolean {
  if (!dimensions || minDimensionPx <= 0) return false;
  return Math.min(dimensions.width, dimensions.height) < minDimensionPx;
}

/**
 * Cuánto del lado del lienzo ocupa el producto en el catálogo. No es una
 * elección de diseño de este módulo: es lo que miden las fotos que ya están
 * publicadas, 2.599 de 2.599 entre 82% y 86% con mediana en 84,0%.
 */
const CATALOG_OCCUPANCY = 0.84;
/** Cuánto se tiene que apartar del blanco un píxel para contar como contenido. */
const CONTENT_THRESHOLD = 12;

/**
 * Rectángulo del contenido: deja afuera el borde casi blanco de la foto.
 *
 * Se compara LUMINANCIA y no canal por canal. Canal por canal es más sensible y
 * en una foto con sombra suave detecta un contenido más grande del real: el
 * lienzo sale acolchado de más y la ocupación termina en 78% en vez de 84%. El
 * catálogo está medido en luminancia, así que ésta es la métrica que converge.
 *
 * No se usa `sharp.trim()`: sobre algunas imágenes no recorta nada en NINGÚN
 * umbral y falla en silencio devolviendo el lienzo entero (medido sobre una foto
 * de 1000×1000 con el producto en 712×752 y las cuatro esquinas en blanco puro).
 */
async function contentBox(content: Buffer) {
  const { data, info } = await sharp(content)
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (255 - lum > CONTENT_THRESHOLD) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Deja la foto con el formato del catálogo: lienzo CUADRADO, relleno BLANCO y el
 * producto ocupando el 84% del lado.
 *
 * POR QUÉ ACÁ Y NO EN EL STOREFRONT. El PLP mete la imagen en una caja
 * `aspect-square` con `object-contain` y `p-[10%]`. Con `contain` la foto ajusta
 * por el lado largo, así que el CSS no puede corregir ni el aspecto ni el aire:
 * una foto de 352×1200 ocupa el 29% del ancho que ocupa una cuadrada, y una
 * cuadrada con mucho blanco alrededor se ve más chica que su vecina aunque las
 * dos midan 1200 px. El contrato tiene una mitad en el CSS y la otra en el
 * archivo, y esta es la mitad del archivo.
 *
 * Blanco y no transparente porque `.product-image-blend` usa
 * `mix-blend-multiply`: sobre eso el blanco desaparece en cualquier fondo claro
 * y la transparencia deja un recuadro.
 *
 * SIN UPSCALE: el lienzo se calcula a partir del contenido ya recortado, así que
 * la resolución nunca se inventa — pero sí puede BAJAR respecto del original, y
 * por eso el gate de resolución mira el resultado de esto y no la descarga cruda.
 *
 * Devuelve `null` si la imagen no se puede procesar (formato raro, lienzo
 * completamente blanco). El llamador sigue con los bytes originales: normalizar
 * es una mejora, no un requisito para publicar.
 */
export async function normalizeToCatalogFormat(
  content: Buffer
): Promise<{ content: Buffer; mimeType: string; extension: string } | null> {
  try {
    const box = await contentBox(content);
    if (!box) return null;
    const cropped = await sharp(content)
      .flatten({ background: '#ffffff' })
      .removeAlpha()
      .extract(box)
      .toBuffer();
    const side = Math.round(Math.max(box.width, box.height) / CATALOG_OCCUPANCY);
    const out = await sharp({
      create: { width: side, height: side, channels: 3, background: '#ffffff' },
    })
      .composite([{ input: cropped, gravity: 'centre' }])
      .webp({ quality: 90 })
      .toBuffer();
    return { content: out, mimeType: 'image/webp', extension: 'webp' };
  } catch {
    return null;
  }
}

/**
 * Baja las imágenes del ERP y las deja en el producto. Nunca lanza: los fallos
 * vuelven en `errors` como warnings del sync.
 */
export async function applyProductImages(
  container: MedusaContainer,
  adapter: ErpAdapter,
  adapterCtx: AdapterContext,
  plan: ProductImagePlan,
  opts: {
    onProgress?: (done: number, total: number) => Promise<void>;
    /** Lado menor mínimo aceptado. Default `DEFAULT_MIN_IMAGE_DIMENSION_PX`. */
    minDimensionPx?: number;
  } = {}
): Promise<ProductImageApplyResult> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const result: ProductImageApplyResult = {
    imported: 0,
    without_image: 0,
    failed: 0,
    too_small: 0,
    bytes: 0,
    aborted: false,
    errors: [],
    touchedProductIds: new Set(),
    failedCodes: [],
    importedCodes: [],
    tooSmallCodes: [],
  };
  if (!plan.fetches.length || !adapter.fetchProductImage) return result;

  const fileModule = container.resolve(Modules.FILE) as unknown as FileWriter;
  const productService = container.resolve(Modules.PRODUCT) as unknown as ProductWriter;

  const minDimensionPx = opts.minDimensionPx ?? DEFAULT_MIN_IMAGE_DIMENSION_PX;

  const total = plan.fetches.length;
  let cursor = 0;
  let done = 0;
  let consecutiveFailures = 0;
  /** Un JWT rechazado no se arregla reintentando: corta la fase entera. */
  let fatal: string | null = null;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (fatal || result.aborted) return;
      const index = cursor++;
      if (index >= total) return;
      const item = plan.fetches[index]!;

      try {
        const image = await withRetries(
          () => adapter.fetchProductImage!(item.code, adapterCtx),
          (error) => {
            // Un 4xx de validación o un JWT rechazado no mejoran reintentando.
            if (error instanceof ErpAuthError) {
              fatal = truncateError(error);
              return false;
            }
            return !(error instanceof ErpNonRetryableError);
          }
        );

        if (!image) {
          // El ERP no tiene foto del artículo: es el caso de 878 de los 2.547
          // artículos de la cuenta real. No cuenta como fallo ni resetea el
          // contador de fallos consecutivos.
          result.without_image += 1;
          continue;
        }

        // Se normaliza ANTES del gate a propósito. El gate existe para no
        // publicar una foto que se va a ver rota, así que tiene que medir lo que
        // se publica: normalizar recorta el aire y el resultado puede ser MÁS
        // CHICO que la descarga (una foto de 1000×1000 con el producto en 300 px
        // termina en 357×357). Medir la cruda dejaría pasar justo ésas.
        //
        // Si no se puede procesar, se sigue con los bytes originales: normalizar
        // es una mejora, no un requisito para publicar.
        const normalized = await normalizeToCatalogFormat(image.content);
        const publish = normalized ?? {
          content: image.content,
          mimeType: image.mime_type,
          extension: image.extension,
        };

        // El gate va acá y no en el planner porque el veredicto necesita los
        // BYTES: hasta que la imagen no está bajada no hay alto ni ancho que
        // mirar. Se descarta antes de subirla para no dejar huérfanos en el
        // bucket.
        if (isImageTooSmall(await readImageDimensions(publish.content), minDimensionPx)) {
          result.too_small += 1;
          result.tooSmallCodes.push(item.code);
          // Se bajó igual: `bytes` mide TRANSFERENCIA, no imágenes guardadas.
          result.bytes += image.content.length;
          if (result.errors.length < 10) {
            result.errors.push(
              `Imagen del artículo ${item.code}: descartada por resolución ` +
                `(una vez recortado el fondo, el lado menor no llega a ${minDimensionPx} px). ` +
                `Cargá en el ERP una foto más grande o con el producto más cerca: ` +
                `se mide el producto, no el lienzo.`
            );
          }
          // A propósito NO toca `consecutiveFailures`: ni lo sube (una tanda de
          // fotos chicas no es un endpoint roto y no debe abortar la fase) ni lo
          // resetea (una descarga que termina sin imagen usable no prueba que el
          // ERP esté sano).
          continue;
        }

        const filename = imageFilename(item.code, publish.extension);
        const [file] = await fileModule.createFiles([
          {
            filename,
            mimeType: publish.mimeType,
            content: publish.content.toString('base64'),
            access: 'public',
          },
        ]);
        if (!file?.url) {
          throw new Error('el File module no devolvió una URL para la imagen subida.');
        }

        // `upsertProducts` con `{id, images, thumbnail}` es un update PARCIAL: no
        // toca variantes ni categorías. Reemplaza la lista de imágenes, y por eso
        // el planner solo deja pasar productos que NO tienen ninguna.
        await productService.upsertProducts([
          { id: item.product_id, images: [{ url: file.url }], thumbnail: file.url },
        ]);

        result.imported += 1;
        result.bytes += image.content.length;
        result.touchedProductIds.add(item.product_id);
        result.importedCodes.push(item.code);
        consecutiveFailures = 0;
      } catch (error) {
        result.failed += 1;
        result.failedCodes.push(item.code);
        consecutiveFailures += 1;
        if (result.errors.length < 10) {
          result.errors.push(`Imagen del artículo ${item.code}: ${truncateError(error)}`);
        }
        if (consecutiveFailures >= ABORT_AFTER_CONSECUTIVE_FAILURES) {
          result.aborted = true;
          return;
        }
      } finally {
        done += 1;
        if (done % PROGRESS_EVERY === 0 && opts.onProgress) {
          // Sin esto una importación larga deja el log de sync sin actividad y el
          // sweep anti-huérfanos lo marca `failed` mientras todavía está corriendo.
          await opts.onProgress(done, total).catch(() => undefined);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));

  if (fatal) {
    result.aborted = true;
    result.errors.push(`Imágenes: la fase se cortó por un error de credenciales — ${fatal}`);
  } else if (result.aborted) {
    result.errors.push(
      `Imágenes: la fase se cortó después de ${ABORT_AFTER_CONSECUTIVE_FAILURES} fallos seguidos ` +
        `(${done} de ${total} artículos intentados). Revisá el endpoint de imágenes del ERP.`
    );
  }

  if (opts.onProgress) await opts.onProgress(done, total).catch(() => undefined);
  logger.info(
    `[erp] catalog sync: imágenes — ${result.imported} importadas, ` +
      `${result.without_image} sin foto en el ERP, ${result.too_small} descartadas por resolución, ` +
      `${result.failed} fallidas (${(result.bytes / 1024 / 1024).toFixed(1)} MB).`
  );
  return result;
}

/**
 * Reintenta con backoff exponencial mientras `shouldRetry` lo permita.
 *
 * Existe por el `ECONNRESET` que volteó la primera corrida a las 327 imágenes:
 * bajar miles de archivos de un server ajeno garantiza que alguno se corte, y
 * eso no puede costar la corrida entera.
 */
async function withRetries<T>(
  job: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await job();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS || !shouldRetry(error)) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
