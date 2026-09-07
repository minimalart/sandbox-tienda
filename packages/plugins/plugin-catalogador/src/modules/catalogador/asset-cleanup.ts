import { Modules } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { CATALOGADOR_MODULE } from './index';
import type { EditableLifestyleMetadata } from './ai/editable-lifestyle';

/**
 * Borrado de los archivos que el Catalogador generó y que ya no sirven.
 *
 * Por qué existe: el módulo era append-only. Se subía TODO antes de que el
 * operador decidiera, la decisión sólo escribía una columna `status`, y no había
 * una sola llamada a `deleteFiles` en el módulo. Cada variación no elegida, cada
 * propuesta rechazada y cada intermedio del lifestyle editable quedaban en el
 * storage para siempre, y cada regeneración multiplicaba el residuo.
 *
 * Lo que NO borra: las imágenes ORIGINALES del producto. Es política explícita
 * (`image_technical.keep_originals`, y los comentarios de `ai/images.ts` y
 * `ai/image-pipeline.ts`). Acá sólo se borra lo que el Catalogador creó.
 */

/** Un archivo subido por el Catalogador, tal como quedó referenciado. */
type AssetRef = { fileId: string | null; url: string | null };

/** La forma mínima de una propuesta que hace falta para saber qué borrar. */
export type CleanableProposal = {
  id: string;
  generated_asset_id?: string | null;
  operation_type?: string | null;
  metadata?: unknown;
};

type FileModuleLike = { deleteFiles: (ids: string | string[]) => Promise<unknown> };
type MediaLibraryLike = {
  listMediaAssets: (filters: Record<string, unknown>) => Promise<Array<{ id: string }>>;
  deleteMediaAssets: (ids: string[]) => Promise<unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

const layerRef = (value: unknown): AssetRef | null => {
  const layer = asRecord(value);
  const url = str(layer.url);
  const fileId = str(layer.file_id);
  return url || fileId ? { fileId, url } : null;
};

/**
 * Archivos INTERMEDIOS de una propuesta: existen sólo para poder producir el
 * resultado y no se referencian nunca desde el producto.
 *
 * Hoy sólo el lifestyle editable tiene intermedios (fondo, capa de producto y
 * preview). El preview es el caso más claro de residuo del módulo: al aplicar,
 * `generated_asset_id` se sobrescribe con el render final y su URL desaparecía de
 * la base mientras el binario sobrevivía en el storage.
 */
export function intermediateRefs(proposal: CleanableProposal): AssetRef[] {
  if (proposal.operation_type !== 'lifestyle_editable') return [];
  const meta = asRecord(proposal.metadata) as Partial<EditableLifestyleMetadata>;
  return [layerRef(meta.background), layerRef(meta.product_layer), layerRef(meta.preview)].filter(
    (r): r is AssetRef => r !== null
  );
}

/**
 * El archivo RESULTADO de una propuesta: lo que se adjuntaría al producto si se
 * acepta. Sólo se borra cuando la propuesta muere (rechazo, cancelación).
 */
export function resultRefs(proposal: CleanableProposal): AssetRef[] {
  const meta = asRecord(proposal.metadata);
  if (proposal.operation_type === 'lifestyle_editable') {
    // Tras aplicar, el resultado es el render final; antes, el preview (que ya
    // viaja en `intermediateRefs`, y de-duplicamos más abajo).
    const final = layerRef(meta.final_render);
    if (final) return [final];
    const generated = str(proposal.generated_asset_id);
    return generated ? [{ fileId: null, url: generated }] : [];
  }
  const url = str(proposal.generated_asset_id);
  const fileId = str(meta.file_id);
  return url || fileId ? [{ fileId, url }] : [];
}

/**
 * Borra un archivo sin poder romper la operación principal.
 *
 * Mismo criterio que `deleteFileBestEffort` de
 * `api/store/customers/me/avatar/route.ts`: ante un fallo de storage preferimos
 * dejar un huérfano antes que hacerle fallar al operador un rechazo o un apply que
 * en lo que importa ya se hizo.
 */
async function deleteRef(
  fileModule: FileModuleLike | null,
  mediaLibrary: MediaLibraryLike | null,
  ref: AssetRef
): Promise<boolean> {
  let deleted = false;

  if (fileModule && ref.fileId) {
    try {
      await fileModule.deleteFiles(ref.fileId);
      deleted = true;
    } catch (error) {
      console.error('[catalogador-cleanup] No se pudo borrar el archivo:', ref.fileId, error);
    }
  }

  // La fila de la biblioteca se borra igual: si quedó sin `file_id` (propuestas
  // viejas), es además el único lugar de donde sacar el id del binario.
  if (mediaLibrary && ref.url) {
    try {
      const rows = await mediaLibrary.listMediaAssets({ url: ref.url });
      if (rows.length) {
        if (fileModule && !ref.fileId) {
          for (const row of rows) {
            const fileId = str((row as Record<string, unknown>).file_id);
            if (!fileId) continue;
            try {
              await fileModule.deleteFiles(fileId);
              deleted = true;
            } catch (error) {
              console.error('[catalogador-cleanup] No se pudo borrar el archivo:', fileId, error);
            }
          }
        }
        await mediaLibrary.deleteMediaAssets(rows.map((r) => r.id));
      }
    } catch (error) {
      console.error('[catalogador-cleanup] No se pudo limpiar la biblioteca de medios:', ref.url, error);
    }
  }

  return deleted;
}

const refKey = (ref: AssetRef) => `${ref.fileId ?? ''}|${ref.url ?? ''}`;

const safeResolve = <T,>(container: MedusaContainer, key: string): T | null => {
  try {
    return container.resolve(key) as T;
  } catch {
    return null;
  }
};

/**
 * Borra los archivos de las propuestas dadas.
 *
 * `mode`:
 *  - `'discard'` — la propuesta murió (rechazada, o su ejecución se canceló/borró):
 *    se van intermedios y resultado.
 *  - `'intermediates'` — la propuesta se APLICÓ: el resultado se queda (lo
 *    referencia el producto) y sólo se van los intermedios.
 *
 * `keepUrls` protege URLs que en este momento referencia el producto. Es la red
 * de seguridad contra borrar una imagen viva: sin ella, dos propuestas que
 * apuntaran al mismo archivo podrían dejar al producto con una URL muerta.
 */
export async function cleanupProposalFiles(
  container: MedusaContainer,
  proposals: CleanableProposal[],
  opts: { mode: 'discard' | 'intermediates'; keepUrls?: Iterable<string> } = { mode: 'discard' }
): Promise<{ deleted: number }> {
  if (!proposals.length) return { deleted: 0 };

  const fileModule = safeResolve<FileModuleLike>(container, Modules.FILE);
  const mediaLibrary = safeResolve<MediaLibraryLike>(container, 'media_library');
  if (!fileModule && !mediaLibrary) return { deleted: 0 };

  const keep = new Set(opts.keepUrls ?? []);
  const refs = new Map<string, AssetRef>();
  for (const proposal of proposals) {
    const own =
      opts.mode === 'discard'
        ? [...intermediateRefs(proposal), ...resultRefs(proposal)]
        : intermediateRefs(proposal);
    for (const ref of own) {
      if (ref.url && keep.has(ref.url)) continue;
      refs.set(refKey(ref), ref);
    }
  }

  let deleted = 0;
  for (const ref of refs.values()) {
    if (await deleteRef(fileModule, mediaLibrary, ref)) deleted++;
  }
  return { deleted };
}

type CatalogadorServiceLike = {
  listCatalogingExecutionProducts: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<Array<{ id: string }>>;
  listCatalogingAssetProposals: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<Array<CleanableProposal & { status?: string | null }>>;
  deleteCatalogingAssetProposals: (ids: string[]) => Promise<unknown>;
};

/**
 * Barrido de TODOS los archivos generados por una ejecución que nunca se aplicaron.
 *
 * `cataloging_asset_proposal` no tiene `execution_id` —sólo `execution_product_id`
 * (ver `models/cataloging-asset-proposal.ts`)— así que hay que pasar por los
 * productos de la corrida. Las propuestas en `applied` se excluyen SIEMPRE: su
 * archivo lo referencia un producto vivo.
 *
 * `productIds` limita el barrido (lo usa la regeneración dirigida).
 * `deleteRows` borra además las filas: sin eso, regenerar dejaría en el tablero de
 * revisión propuestas apuntando a archivos que ya no existen.
 */
export async function cleanupExecutionFiles(
  container: MedusaContainer,
  executionId: string,
  opts: { productIds?: string[]; deleteRows?: boolean } = {}
): Promise<{ deleted: number; proposals: number }> {
  const service = safeResolve<CatalogadorServiceLike>(container, CATALOGADOR_MODULE);
  if (!service) return { deleted: 0, proposals: 0 };

  const productFilter: Record<string, unknown> = { execution_id: executionId };
  if (opts.productIds?.length) productFilter.id = opts.productIds;
  const products = await service.listCatalogingExecutionProducts(productFilter, {
    take: null as unknown as number,
  });
  if (!products.length) return { deleted: 0, proposals: 0 };

  const proposals = (
    await service.listCatalogingAssetProposals(
      { execution_product_id: products.map((p) => p.id) },
      { take: null as unknown as number }
    )
  ).filter((a) => a.status !== 'applied');
  if (!proposals.length) return { deleted: 0, proposals: 0 };

  const { deleted } = await cleanupProposalFiles(container, proposals, { mode: 'discard' });
  if (opts.deleteRows) {
    await service.deleteCatalogingAssetProposals(proposals.map((a) => a.id)).catch((error) => {
      console.error('[catalogador-cleanup] No se pudieron borrar las propuestas:', error);
    });
  }
  return { deleted, proposals: proposals.length };
}

/**
 * Borra archivos recién subidos que ya no van a referenciarse.
 *
 * Para el camino de FALLO del pipeline: los tres assets del lifestyle editable se
 * suben ANTES de crear la propuesta, así que si el tercero falla —o falla el insert
 * de la propuesta— los dos primeros quedaban en el storage y el `catch` creaba una
 * propuesta en `error` con `generated_asset_id: null`, descartando sus URLs. Nadie
 * podía volver a encontrarlos.
 */
export async function cleanupUploadedFiles(
  container: MedusaContainer,
  uploads: Array<{ id?: string | null; url?: string | null } | null | undefined>
): Promise<{ deleted: number }> {
  const refs = uploads
    .filter((u): u is { id?: string | null; url?: string | null } => Boolean(u))
    .map((u) => ({ fileId: str(u.id), url: str(u.url) }))
    .filter((r) => r.fileId || r.url);
  if (!refs.length) return { deleted: 0 };

  const fileModule = safeResolve<FileModuleLike>(container, Modules.FILE);
  const mediaLibrary = safeResolve<MediaLibraryLike>(container, 'media_library');
  if (!fileModule && !mediaLibrary) return { deleted: 0 };

  const unique = new Map(refs.map((r) => [refKey(r), r]));
  let deleted = 0;
  for (const ref of unique.values()) {
    if (await deleteRef(fileModule, mediaLibrary, ref)) deleted++;
  }
  return { deleted };
}
