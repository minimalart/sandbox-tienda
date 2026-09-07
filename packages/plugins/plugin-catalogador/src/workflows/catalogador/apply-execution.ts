import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { CATALOGADOR_MODULE } from '../../modules/catalogador';
import type CatalogadorModuleService from '../../modules/catalogador/service';
import { getCatalogadorConfig, type CatalogadorConfig } from '../../modules/catalogador/config';
import { cleanupProposalFiles } from '../../modules/catalogador/asset-cleanup';
import {
  RETRYABLE_PRODUCT_STATUSES,
  UNFINISHED_PRODUCT_STATUSES,
  resolveApplyFinalStatus,
} from '../../modules/catalogador/apply-status';
import { fetchImageBytes } from '../../modules/catalogador/ai/images';
import {
  clampComposition,
  renderEditableLifestyle,
  type EditableLifestyleMetadata,
} from '../../modules/catalogador/ai/editable-lifestyle';

/**
 * Aplicación de cambios revisados (PRD §18). Es idempotente y de éxito parcial:
 * NO llama a IA/scraping/barcode (PRD §18.2), sólo escribe lo aceptado por el
 * usuario. Antes de escribir guarda un snapshot `pre`; después, un snapshot
 * `post` (PRD §19). Detecta cambios concurrentes comparando los valores
 * actuales contra `current_snapshot` capturado al generar (PRD §18.4): si un
 * campo cambió, NO se sobrescribe y se marca como conflicto.
 *
 * Se expone como función (la invoca el job catalogador-process) para poder
 * reanudarse por tick sin estado en memoria.
 */

const FREEFORM_TO_COLUMN: Record<string, 'subtitle' | 'description'> = {
  subtitle: 'subtitle',
  description: 'description',
};
const METADATA_FIELDS = ['meta_title', 'meta_description', 'keywords', 'alt_text'];

export async function applyExecution(container: MedusaContainer, executionId: string): Promise<void> {
  const service = container.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const productModule = container.resolve(Modules.PRODUCT);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const execution = await service.retrieveCatalogingExecution(executionId);
  if (execution.status !== 'applying') return;

  // Config para el render final del lifestyle editable (PRD §11). Se carga una
  // vez por ejecución; es best-effort para el resto de la aplicación.
  //
  // Con el site de la EJECUCIÓN, igual que `jobs/catalogador-process.ts`: sin él
  // `readSetting` lee la fila global y el render final sale con otra calidad y
  // otro peso objetivo que el resto de las imágenes de la misma corrida.
  const siteId = (execution.site_id as string | null) ?? null;
  const config = await getCatalogadorConfig(container, siteId).catch(() => null);

  // Productos aplicables: aceptados (texto) o con imágenes aceptadas.
  const allProducts = await service.listCatalogingExecutionProducts(
    { execution_id: executionId },
    { take: null as unknown as number, order: { created_at: 'ASC' } }
  );
  const products = allProducts.filter((p) => !['excluded', 'applied'].includes(p.status as string));

  let applied = 0;
  let failed = 0;

  for (const p of products) {
    // `apply_failed` también entra: sus `accepted_changes` siguen ahí y el fallo
    // pudo ser transitorio (una descarga, el File Module) o resoluble (todo era
    // conflicto y el operador ya lo miró). Leer sólo `accepted` dejaba a esos
    // productos fuera de TODO re-apply: el comentario de `renderEditableFinal`
    // prometía "se puede reintentar (PRD §14)" y en la práctica no se reintentaba
    // nunca — la única salida era volver a aceptar un campo a mano para que la
    // ruta de revisión los devolviera a `accepted`.
    const accepted = RETRYABLE_PRODUCT_STATUSES.includes(p.status as string)
      ? ((p.accepted_changes ?? {}) as Record<string, unknown>)
      : {};

    // Imágenes aceptadas para este producto (se adjuntan como secundarias).
    const acceptedAssets = await service.listCatalogingAssetProposals(
      { execution_product_id: p.id, status: 'accepted' },
      { take: null as unknown as number }
    );

    if (Object.keys(accepted).length === 0 && acceptedAssets.length === 0) continue;

    try {
      // Releer estado actual del producto (para conflictos + snapshot pre).
      const { data } = await query.graph({
        entity: 'product',
        fields: [
          'id',
          'subtitle',
          'description',
          'metadata',
          'thumbnail',
          'images.id',
          'images.url',
          'categories.id',
          'tags.id',
        ],
        filters: { id: p.product_id },
      });
      const current = (data as Array<Record<string, unknown>>)[0];
      if (!current) throw new Error('Producto no encontrado al aplicar');

      const prevSnapshot = (p.current_snapshot ?? {}) as Record<string, unknown>;
      const conflicts: string[] = [];
      const updatePayload: Record<string, unknown> = {};
      const metadataPatch: Record<string, unknown> = {};
      const preData: Record<string, unknown> = {};

      for (const [field, rawAccepted] of Object.entries(accepted)) {
        // Defensa: si por datos viejos el valor aceptado quedó como el objeto de
        // propuesta { value, ... } en vez del valor crudo, se desenvuelve.
        const value =
          rawAccepted && typeof rawAccepted === 'object' && 'value' in (rawAccepted as Record<string, unknown>)
            ? (rawAccepted as { value: unknown }).value
            : rawAccepted;

        const currentVal = currentValueForField(current, field);
        preData[field] = currentVal ?? null;

        // Conflicto: el valor actual difiere del que había al generar (alguien
        // lo cambió en el medio). No se sobrescribe (PRD §18.4).
        if (field in prevSnapshot && !valuesEqual(prevSnapshot[field], currentVal)) {
          conflicts.push(field);
          continue;
        }

        if (FREEFORM_TO_COLUMN[field]) {
          updatePayload[FREEFORM_TO_COLUMN[field]] = value;
        } else if (METADATA_FIELDS.includes(field)) {
          metadataPatch[field] = value;
        } else if (field === 'categories') {
          const ids = Array.isArray(value) ? (value as string[]) : [];
          updatePayload.categories = ids.map((id) => ({ id }));
        } else if (field === 'tags') {
          const ids = Array.isArray(value) ? (value as string[]) : [];
          updatePayload.tags = ids.map((id) => ({ id }));
        }
      }

      // Imágenes aceptadas:
      //  - Optimizaciones TÉCNICAS (is_ai_generated=false): REEMPLAZAN en su lugar
      //    la imagen original (misma posición/id), sin sumar copias.
      //  - Generadas por IA (is_ai_generated=true): se AGREGAN como secundarias.
      // El original se conserva en la biblioteca de medios (no se borra).
      const existingImages = ((current.images as Array<{ id?: string; url?: string }>) ?? []).filter(
        (i) => i.url
      ) as Array<{ id?: string; url: string }>;
      const existingUrls = new Set(existingImages.map((i) => i.url));
      const replaceMap = new Map<string, string>();
      const additions: string[] = [];
      // Renders finales del lifestyle editable (assetId → asset final) para
      // actualizar la propuesta tras aplicar (PRD §11).
      const editableFinals = new Map<string, { url: string; file_id?: string }>();
      for (const a of acceptedAssets) {
        // Lifestyle editable: el render definitivo se hace ACÁ, con la última
        // composición guardada (PRD §11). Si falla, lanza → el producto queda
        // apply_failed y se puede reintentar (PRD §14).
        if (a.operation_type === 'lifestyle_editable') {
          const finalAsset = await renderEditableFinal(container, a, config, siteId);
          editableFinals.set(a.id, finalAsset);
          additions.push(finalAsset.url);
          continue;
        }
        const gen = a.generated_asset_id;
        if (!gen) continue;
        // `import_external` (imagen real traída de la web) NO reemplaza nada: el
        // producto no tenía imagen, se AGREGA como nueva. El resto de las no-IA
        // (optimizaciones técnicas) reemplazan su imagen de origen.
        if (a.is_ai_generated || a.operation_type === 'import_external') additions.push(gen);
        else if (a.source_asset_id) replaceMap.set(a.source_asset_id, gen);
      }
      const newAdditions = [...new Set(additions)].filter((u) => !existingUrls.has(u));
      if (replaceMap.size > 0 || newAdditions.length > 0) {
        preData.images = existingImages.map((i) => i.url);
        const rebuilt = existingImages.map((i) => {
          const replaced = replaceMap.get(i.url);
          const url = replaced ?? i.url;
          return i.id ? { id: i.id, url } : { url };
        });
        updatePayload.images = [...rebuilt, ...newAdditions.map((url) => ({ url }))];
        const currentThumb = current.thumbnail as string | undefined;
        if (currentThumb && replaceMap.has(currentThumb)) {
          updatePayload.thumbnail = replaceMap.get(currentThumb);
        }
      }

      const appliedFields = Object.keys(updatePayload).length + Object.keys(metadataPatch).length;
      const nothingToApply =
        Object.keys(updatePayload).length === 0 && Object.keys(metadataPatch).length === 0;
      if (nothingToApply) {
        // Todo era conflicto → no se aplica, se marca para decisión del usuario.
        await service.updateCatalogingExecutionProducts([
          {
            id: p.id,
            status: 'apply_failed',
            warnings: conflicts.map((f) => `Conflicto en "${f}"`) as unknown as Record<string, unknown>,
          },
        ]);
        failed++;
        continue;
      }
      void appliedFields;

      // Snapshot PRE (sólo campos afectados).
      await service.createCatalogingSnapshots([
        { execution_id: executionId, product_id: p.product_id, type: 'pre', data: preData },
      ]);

      if (Object.keys(metadataPatch).length) {
        const currentMeta = (current.metadata as Record<string, unknown>) ?? {};
        updatePayload.metadata = { ...currentMeta, ...metadataPatch };
      }

      await productModule.updateProducts(p.product_id, updatePayload);

      // Marca las imágenes aceptadas como aplicadas. Para el lifestyle editable,
      // además apunta `generated_asset_id` al render final y guarda `final_render`
      // en metadata (PRD §11 pasos 9-10).
      if (acceptedAssets.length) {
        await service.updateCatalogingAssetProposals(
          acceptedAssets.map((a) => {
            const patch: Record<string, unknown> = { id: a.id, status: 'applied' as const };
            const finalAsset = editableFinals.get(a.id);
            if (finalAsset) {
              patch.generated_asset_id = finalAsset.url;
              const meta = (a.metadata ?? {}) as Record<string, unknown>;
              patch.metadata = { ...meta, final_render: { url: finalAsset.url, file_id: finalAsset.file_id } };
            }
            return patch as never;
          })
        );
        for (const a of acceptedAssets) {
          if (editableFinals.has(a.id)) {
            await service.logActivity({
              execution_id: executionId,
              execution_product_id: p.id,
              type: 'catalogador.lifestyle_editable.applied',
              metadata: { asset_id: a.id },
            });
          }
        }

        // Intermedios del lifestyle editable: con el render final ya subido y
        // referenciado por el producto, el fondo, la capa de producto y el preview
        // no vuelven a usarse. El preview era el residuo más difícil de rastrear:
        // el patch de arriba acaba de sobrescribir su `generated_asset_id`, así que
        // sin este barrido su archivo quedaba huérfano y sin ninguna referencia.
        const appliedEditables = acceptedAssets.filter((a) => editableFinals.has(a.id));
        if (appliedEditables.length) {
          await cleanupProposalFiles(container, appliedEditables, {
            mode: 'intermediates',
            keepUrls: [...editableFinals.values()].map((f) => f.url),
          });
        }
      }

      // Propuestas NO aceptadas de un producto ya aplicado: su archivo está subido y
      // nunca va a referenciarse. Se descartan acá y no al rechazar porque un
      // producto puede aplicarse con propuestas que quedaron sin decidir.
      const staleAssets = (
        await service.listCatalogingAssetProposals(
          { execution_product_id: p.id },
          { take: null as unknown as number }
        )
      ).filter((a) => ['proposed', 'pending', 'rejected'].includes(a.status as string));
      if (staleAssets.length) {
        // Todo lo que el producto referencia es intocable: las imágenes que ya
        // tenía, las que acaba de recibir y el thumbnail. Se arma con las tres
        // fuentes y no sólo con `updatePayload.images` porque ese campo queda
        // `undefined` cuando la aplicación no tocó imágenes, y un `keepUrls` vacío
        // ahí dejaría al producto con una URL muerta.
        const liveUrls = new Set<string>(existingImages.map((i) => i.url));
        for (const img of (updatePayload.images as Array<{ url?: string }> | undefined) ?? []) {
          if (img.url) liveUrls.add(img.url);
        }
        const thumb = (updatePayload.thumbnail as string | undefined) ?? (current.thumbnail as string | undefined);
        if (thumb) liveUrls.add(thumb);
        await cleanupProposalFiles(container, staleAssets, { mode: 'discard', keepUrls: liveUrls });
      }

      // Snapshot POST.
      const postData: Record<string, unknown> = {};
      for (const field of Object.keys(accepted)) {
        if (conflicts.includes(field)) continue;
        postData[field] = accepted[field];
      }
      await service.createCatalogingSnapshots([
        { execution_id: executionId, product_id: p.product_id, type: 'post', data: postData },
      ]);

      await service.updateCatalogingExecutionProducts([
        {
          id: p.id,
          status: 'applied',
          warnings: (conflicts.length
            ? conflicts.map((f) => `Conflicto no aplicado en "${f}"`)
            : null) as unknown as Record<string, unknown> | null,
        },
      ]);
      await service.logActivity({
        execution_id: executionId,
        execution_product_id: p.id,
        type: 'applied',
        metadata: { fields: Object.keys(accepted), conflicts },
      });
      applied++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await service.updateCatalogingExecutionProducts([
        { id: p.id, status: 'apply_failed', errors: [message] as unknown as Record<string, unknown> },
      ]);
      await service.logActivity({
        execution_id: executionId,
        execution_product_id: p.id,
        type: 'apply_failed',
        metadata: { message },
      });
      failed++;
    }
  }

  // Trabajo pendiente medido DESPUÉS del loop, sobre los statuses ya escritos:
  // medirlo antes contaba como pendientes a los `accepted` que el propio loop
  // estaba por convertir en `applied`, y no veía a los que acababan de quedar
  // `apply_failed`. La regla vive en `apply-status.ts` (puro y testeado): este
  // workflow no se puede correr sin container, así que acá adentro la decisión no
  // era testeable.
  const afterProducts = await service.listCatalogingExecutionProducts(
    { execution_id: executionId },
    { take: null as unknown as number }
  );
  const unfinished = afterProducts.filter((p) =>
    UNFINISHED_PRODUCT_STATUSES.includes(p.status as string)
  ).length;
  const finalStatus = resolveApplyFinalStatus({ applied, failed, unfinished });
  await service.setStatus(executionId, finalStatus);
  await service.updateCatalogingExecutions([
    {
      id: executionId,
      // `unfinished` explícito: sin él, un `applied + failed < total` era la
      // única pista de que la corrida había dejado productos atrás, y había que
      // deducirla restando.
      summary: { applied, failed, unfinished, total: products.length },
    },
  ]);
  await service.recomputeProgress(executionId);

  // Si esto era una restauración que se aplicó (aunque sea parcialmente), la
  // ejecución de origen queda marcada como "restored" (PRD §8).
  if (
    execution.kind === 'restoration' &&
    execution.restored_from_execution_id &&
    finalStatus !== 'error'
  ) {
    await service.updateCatalogingExecutions([
      { id: execution.restored_from_execution_id, status: 'restored' },
    ]);
    await service.logActivity({
      execution_id: execution.restored_from_execution_id,
      type: 'restored',
      metadata: { by_execution: executionId },
    });
  }
}

/**
 * Render final del lifestyle editable (PRD §11): descarga fondo + capa de
 * producto, compone con la última composición guardada, sube el WebP al File
 * Module y lo registra en la Media Library. Lanza si falta un asset o falla la
 * descarga/subida (el producto quedará `apply_failed` y podrá reintentarse).
 */
async function renderEditableFinal(
  container: MedusaContainer,
  proposal: { id: string; metadata: unknown },
  config: CatalogadorConfig | null,
  siteId: string | null
): Promise<{ url: string; file_id?: string }> {
  const cfg = config ?? (await getCatalogadorConfig(container, siteId));
  const meta = (proposal.metadata ?? {}) as Partial<EditableLifestyleMetadata>;
  const bgUrl = meta.background?.url;
  const productUrl = meta.product_layer?.url;
  if (!bgUrl || !productUrl) {
    throw new Error('La propuesta lifestyle editable no tiene assets para renderizar.');
  }

  const [bg, product] = await Promise.all([fetchImageBytes(bgUrl), fetchImageBytes(productUrl)]);
  if (!bg) throw new Error('No se pudo descargar el fondo lifestyle.');
  if (!product) throw new Error('No se pudo descargar la capa del producto.');

  const composition = clampComposition(meta.composition ?? {}, cfg.image_ai.editable_lifestyle_default_scale);
  const rendered = await renderEditableLifestyle({ background: bg, product, composition, config: cfg });

  const fileModule = container.resolve(Modules.FILE) as unknown as {
    createFiles: (
      files: Array<{ filename: string; mimeType: string; content: string; access: string }>
    ) => Promise<Array<{ id: string; url: string }>>;
  };
  const token = Math.random().toString(36).slice(2, 10);
  const filename = `catalogador/lifestyle-editable-${proposal.id}-${token}.webp`;
  const [file] = await fileModule.createFiles([
    { filename, mimeType: rendered.mimeType, content: rendered.buffer.toString('base64'), access: 'public' },
  ]);
  if (!file) throw new Error('No se pudo subir el render final del lifestyle editable.');

  try {
    const mediaLibrary = container.resolve('media_library') as unknown as {
      registerAsset: (input: Record<string, unknown>) => Promise<unknown>;
    };
    await mediaLibrary
      .registerAsset({
        url: file.url,
        file_id: file.id,
        filename,
        mime_type: rendered.mimeType,
        size: rendered.bytes,
        source: 'catalogador',
        metadata: { ai_generated: true, lifestyle_editable: true },
      })
      .catch(() => undefined);
  } catch {
    // media library es opcional
  }

  return { url: file.url, file_id: file.id };
}

function currentValueForField(product: Record<string, unknown>, field: string): unknown {
  switch (field) {
    case 'subtitle':
      return (product.subtitle as string) ?? null;
    case 'description':
      return (product.description as string) ?? null;
    case 'categories':
      return ((product.categories as Array<{ id?: string }>) ?? []).map((c) => c.id).filter(Boolean);
    case 'tags':
      return ((product.tags as Array<{ id?: string }>) ?? []).map((t) => t.id).filter(Boolean);
    case 'meta_title':
    case 'meta_description':
    case 'keywords':
    case 'alt_text':
      return ((product.metadata as Record<string, unknown>) ?? {})[field] ?? null;
    default:
      return null;
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const sa = [...a].map(String).sort();
    const sb = [...b].map(String).sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
