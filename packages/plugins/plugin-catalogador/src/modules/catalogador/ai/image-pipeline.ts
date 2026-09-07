import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { CATALOGADOR_MODULE } from '../index';
import type CatalogadorModuleService from '../service';
import type { CatalogadorConfig } from '../config';
import type { AssetOperationType } from '../models';
import {
  extensionForMime,
  fetchImageBytes,
  generateProductImage,
  inspectImage,
  normalizeSquareWebp,
  processTechnical,
  toDataUrl,
  type ImageAiKind,
  type ProcessedImage,
} from './images';
import { buildEditableLifestyle, type EditableLifestyleMetadata } from './editable-lifestyle';
import { cleanupUploadedFiles } from '../asset-cleanup';
import { gatherExternalContext } from './external';
import { pickProductBarcode } from './barcode';

const TECHNICAL_OPS = new Set(['to_webp', 'compress', 'resize', 'normalize']);
const AI_OPS = new Set(['recreate', 'lifestyle', 'lifestyle_editable', 'background', 'generate_missing', 'variation']);

type MediaLibraryLike = {
  registerAsset: (input: Record<string, unknown>) => Promise<{ id: string } | undefined>;
};
type FileLike = {
  createFiles: (
    files: Array<{ filename: string; mimeType: string; content: string; access: string }>
  ) => Promise<Array<{ id: string; url: string }>>;
};

/**
 * Procesa las operaciones de imagen de un producto (PRD §12.2/§12.3) y crea
 * `cataloging_asset_proposal` para revisión. Sube los resultados al File module
 * y los registra en la biblioteca de medios. Conserva SIEMPRE los originales y
 * nunca reemplaza la imagen principal (eso se decide al aplicar, sólo si el
 * usuario acepta y la regla lo permite).
 */
export async function processImagesForProduct(opts: {
  container: MedusaContainer;
  executionId?: string;
  executionProductId: string;
  productId: string;
  config: CatalogadorConfig;
  operations: Array<{ type: string; field: string }>;
  /**
   * URLs de imágenes reales encontradas en la web (Tavily). Se usan como base
   * SÓLO cuando el producto no tiene ninguna foto propia; nunca se alucina desde
   * el título. Vienen del contexto externo ya recolectado en el paso de texto.
   */
  externalImageCandidates?: string[];
}): Promise<{ created: number; warnings: string[] }> {
  const { container, config } = opts;
  const service = container.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const fileModule = container.resolve(Modules.FILE) as unknown as FileLike;
  const mediaLibrary = safeResolve<MediaLibraryLike>(container, 'media_library');
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const warnings: string[] = [];

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
  const product = (data as Array<Record<string, unknown>>)[0];
  if (!product) return { created: 0, warnings: ['Producto no encontrado'] };

  const variants =
    (product.variants as Array<{
      sku?: string;
      barcode?: string;
      ean?: string;
      upc?: string;
      metadata?: Record<string, unknown> | null;
    }>) ?? [];
  const images = ((product.images as Array<{ url?: string }>) ?? []).map((i) => i.url).filter(Boolean) as string[];
  const mainUrl = (product.thumbnail as string) || images[0] || null;
  const title = (product.title as string) || 'producto';

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
  const optimizeCandidates = [...new Set([mainUrl, ...images].filter((u): u is string => Boolean(u)))];
  const imagesToOptimize = optimizeCandidates.slice(0, MAX_OPTIMIZE);
  // El tope se avisa: truncar en silencio se lee como "se procesó todo".
  if (optimizeCandidates.length > MAX_OPTIMIZE) {
    warnings.push(
      `El producto tiene ${optimizeCandidates.length} imágenes: se optimizaron las primeras ${MAX_OPTIMIZE}.`
    );
  }
  if (techFields.length && imagesToOptimize.length) {
    for (const url of imagesToOptimize) {
      try {
        const src = await fetchImageBytes(url);
        if (!src) {
          warnings.push(`No se pudo descargar la imagen para optimizar`);
          continue;
        }
        const before = await inspectImage(src);
        // `processTechnical` compone las etapas elegidas. Antes acá había un ternario
        // `normalize ? ... : ...` que hacía que marcar sólo "Redimensionar", sólo
        // "Comprimir" o sólo "Convertir a WebP" diera el MISMO resultado, y que
        // "Comprimir" no aplicara `max_kb` en cuanto "Normalizar" estaba tildado.
        const result = await processTechnical(src, {
          ops: techFields,
          quality: config.image_technical.webp_quality,
          maxKb: config.image_technical.max_kb,
          maxDimension: config.image_technical.max_dimension,
        });
        const asset = await uploadResult(fileModule, mediaLibrary, title, result, false);
        if (result.targetKbMissed) {
          warnings.push(
            `Una imagen quedó en ${Math.round(result.bytes / 1024)}KB, por encima del objetivo de ` +
              `${config.image_technical.max_kb}KB (ya en la calidad mínima).`
          );
        }
        await service.createCatalogingAssetProposals([
          {
            execution_product_id: opts.executionProductId,
            source_asset_id: url,
            generated_asset_id: asset?.url ?? null,
            operation_type: 'optimize' as AssetOperationType,
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
      } catch (e) {
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
    const refUrls = [...new Set([mainUrl, ...images].filter((u): u is string => Boolean(u)))].slice(0, MAX_REF_IMAGES);
    const ownRefs: string[] = [];
    for (const u of refUrls) {
      const bytes = await fetchImageBytes(u);
      if (bytes) ownRefs.push(toDataUrl(bytes, 'image/jpeg'));
    }

    // Candidatas de imagen web: las trae el paso de texto (opts). Para
    // ejecuciones SÓLO de imagen (sin campos de texto) el paso de texto no
    // corrió, así que se recolectan acá una vez (no hay duplicación de llamadas).
    let externalCandidates = opts.externalImageCandidates;
    if (
      externalCandidates === undefined &&
      ownRefs.length === 0 &&
      aiOps.some((o) => o.field === 'generate_missing')
    ) {
      const barcode = pickProductBarcode(variants);
      const ext = await gatherExternalContext({ config, barcode, title });
      externalCandidates = ext?.image_candidates ?? [];
      if (ext?.warnings?.length) warnings.push(...ext.warnings);
    }

    // Imágenes reales de la web (Tavily): se descargan y validan por tamaño
    // (descarta thumbnails) sólo si alguna operación las necesita. Memoizado.
    // Si NINGUNA alcanza `min_dimension`, la más grande (piso 200px) se usa
    // igual como referencia para IA (`belowMinDim`): alcanza para recrear,
    // pero no para importarla tal cual al catálogo.
    const MIN_FALLBACK_DIM = 200;
    let externalRefsCache: {
      dataUrls: string[];
      firstBytes: Buffer | null;
      firstUrl: string | null;
      belowMinDim: boolean;
      candidateCount: number;
    } | null = null;
    const getExternalRefs = async () => {
      if (externalRefsCache) return externalRefsCache;
      const candidates = (externalCandidates ?? []).slice(0, MAX_REF_IMAGES);
      const dataUrls: string[] = [];
      let firstBytes: Buffer | null = null;
      let firstUrl: string | null = null;
      let fallback: { bytes: Buffer; url: string; side: number } | null = null;
      const minDim = config.image_technical.min_dimension || 0;
      for (const url of candidates) {
        const bytes = await fetchImageBytes(url);
        if (!bytes) continue;
        let side: number;
        try {
          const meta = await inspectImage(bytes);
          side = Math.min(meta.width, meta.height);
        } catch {
          continue;
        }
        if (minDim && side < minDim) {
          if (side >= MIN_FALLBACK_DIM && (!fallback || side > fallback.side)) fallback = { bytes, url, side };
          continue;
        }
        if (!firstBytes) {
          firstBytes = bytes;
          firstUrl = url;
        }
        dataUrls.push(toDataUrl(bytes, 'image/jpeg'));
        if (dataUrls.length >= 3) break;
      }
      let belowMinDim = false;
      if (!firstBytes && fallback) {
        belowMinDim = true;
        firstBytes = fallback.bytes;
        firstUrl = fallback.url;
        dataUrls.push(toDataUrl(fallback.bytes, 'image/jpeg'));
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
          const uploaded: Array<{ id: string; url: string } | null> = [];
          try {
            const references = await referenceBytesList(mainUrl, images);
            if (references.length === 0) {
              warnings.push('"lifestyle_editable" requiere una imagen de referencia');
              continue;
            }
            const built = await buildEditableLifestyle({ config, productTitle: title, references });
            const productAsset = await uploadResult(fileModule, mediaLibrary, title, built.product, true);
            uploaded.push(productAsset);
            const backgroundAsset = await uploadResult(fileModule, mediaLibrary, title, built.background, true);
            uploaded.push(backgroundAsset);
            const previewAsset = await uploadResult(fileModule, mediaLibrary, title, built.preview, true);
            uploaded.push(previewAsset);
            if (!productAsset || !backgroundAsset || !previewAsset) {
              throw new Error('No se pudieron subir los assets del lifestyle editable.');
            }
            const metadata: EditableLifestyleMetadata = {
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
                operation_type: 'lifestyle_editable' as AssetOperationType,
                status: 'proposed',
                is_ai_generated: true,
                generation_provider: 'openrouter',
                generation_model: config.image_ai.model,
                metadata: metadata as unknown as Record<string, unknown>,
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
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            // La propuesta queda en `error` con `generated_asset_id: null`, así que
            // lo ya subido es inalcanzable: se borra acá o no se borra nunca.
            await cleanupUploadedFiles(container, uploaded);
            // Recorte/generación falló → la propuesta queda en error (PRD §14).
            await service.createCatalogingAssetProposals([
              {
                execution_product_id: opts.executionProductId,
                source_asset_id: mainUrl,
                generated_asset_id: null,
                operation_type: 'lifestyle_editable' as AssetOperationType,
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
            const message =
              reason === 'scraping_disabled'
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
            warnings.push(
              'La imagen web encontrada es menor a la dimensión mínima: se usa sólo como referencia para la IA (no se importa tal cual).'
            );
          } else {
            const realOptimized = await normalizeSquareWebp(ext.firstBytes, {
              size: Math.min(config.image_technical.max_dimension, 1200),
              quality: config.image_technical.webp_quality,
            });
            const realAsset = await uploadResult(fileModule, mediaLibrary, title, realOptimized, false);
            await service.createCatalogingAssetProposals([
              {
                execution_product_id: opts.executionProductId,
                source_asset_id: ext.firstUrl,
                generated_asset_id: realAsset?.url ?? null,
                operation_type: 'import_external' as AssetOperationType,
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
          const recreated = await generateProductImage({
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
              operation_type: 'generate_missing' as AssetOperationType,
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
          const result = await generateProductImage({
            config,
            kind: op.field as ImageAiKind,
            productTitle: title,
            referenceImages: refs,
          });
          const asset = await uploadResult(fileModule, mediaLibrary, title, result, true);
          await service.createCatalogingAssetProposals([
            {
              execution_product_id: opts.executionProductId,
              source_asset_id: mainUrl,
              generated_asset_id: asset?.url ?? null,
              operation_type: op.field as AssetOperationType,
              status: 'proposed',
              is_ai_generated: true,
              generation_provider: 'openrouter',
              generation_model: config.image_ai.model,
              metadata: { variation: i + 1, bytes: result.bytes, file_id: asset?.id ?? null },
            },
          ]);
          created++;
        }
      } catch (e) {
        warnings.push(`Imagen IA "${op.field}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { created, warnings };
}

async function uploadResult(
  fileModule: FileLike,
  mediaLibrary: MediaLibraryLike | null,
  title: string,
  image: ProcessedImage,
  aiGenerated: boolean
): Promise<{ id: string; url: string } | null> {
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
  const ext = extensionForMime(image.mimeType);
  const filename = `catalogador/${slug || 'producto'}-${aiGenerated ? 'ai' : 'opt'}-${randomToken()}.${ext}`;
  const [file] = await fileModule.createFiles([
    { filename, mimeType: image.mimeType, content: image.buffer.toString('base64'), access: 'public' },
  ]);
  if (!file) return null;
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
function randomToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Bytes de las imágenes candidatas del producto (principal primero), hasta un
 * tope. El recorte del lifestyle editable las prueba en orden buscando una de
 * fondo uniforme (la de catálogo sobre blanco) antes de caer al fallback IA.
 */
async function referenceBytesList(mainUrl: string | null, images: string[], max = 4): Promise<Buffer[]> {
  const candidates = [...new Set([mainUrl, ...images].filter((u): u is string => Boolean(u)))].slice(0, max);
  const buffers: Buffer[] = [];
  for (const url of candidates) {
    const bytes = await fetchImageBytes(url);
    if (bytes) buffers.push(bytes);
  }
  return buffers;
}

function safeResolve<T>(container: MedusaContainer, key: string): T | null {
  try {
    return container.resolve(key) as T;
  } catch {
    return null;
  }
}
