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

        // El gate va acá y no en el planner porque el veredicto necesita los
        // BYTES: hasta que la imagen no está bajada no hay alto ni ancho que
        // mirar. Se descarta antes de subirla para no dejar huérfanos en el
        // bucket.
        if (isImageTooSmall(await readImageDimensions(image.content), minDimensionPx)) {
          result.too_small += 1;
          result.tooSmallCodes.push(item.code);
          // Se bajó igual: `bytes` mide TRANSFERENCIA, no imágenes guardadas.
          result.bytes += image.content.length;
          if (result.errors.length < 10) {
            result.errors.push(
              `Imagen del artículo ${item.code}: descartada por resolución ` +
                `(el lado menor no llega a ${minDimensionPx} px). Cargá una foto más grande en el ERP.`
            );
          }
          // A propósito NO toca `consecutiveFailures`: ni lo sube (una tanda de
          // fotos chicas no es un endpoint roto y no debe abortar la fase) ni lo
          // resetea (una descarga que termina sin imagen usable no prueba que el
          // ERP esté sano).
          continue;
        }

        const filename = imageFilename(item.code, image.extension);
        const [file] = await fileModule.createFiles([
          {
            filename,
            mimeType: image.mime_type,
            content: image.content.toString('base64'),
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
