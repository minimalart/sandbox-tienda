import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { truncateError } from '../sanitize';
import { isErpOwnedVariant, type StatusCandidate, type StatusChange } from './plan-product-status';

/**
 * Lado de ESCRITURA del estado de publicación. La decisión la toma
 * `planProductStatuses` (pura); acá solo se ejecuta.
 *
 * Va por `productService.upsertProducts` y NO por `updateProductsWorkflow`, misma
 * razón que `applyProductMetadata`: el workflow emite `product.updated` por
 * producto y en este repo eso dispara un reindex de Typesense por producto. Con un
 * barrido completo serían miles; el motor emite en cambio UN evento batcheado al
 * final, y ese reindex ya sabe SACAR del índice lo que quedó en borrador (ver
 * `reindexProductsByIds`: "los que no resuelven (draft o borrados) se ELIMINAN").
 *
 * `upsertProducts` con `{ id, status }` es un update PARCIAL: no toca variantes,
 * categorías, precios ni imágenes. Despublicar es reversible sin perder nada.
 */

/** Productos por llamada al upsert de estado. */
const STATUS_CHUNK = 200;
/** Variantes por página al barrer el catálogo buscando productos del ERP. */
const OWNED_PAGE_SIZE = 500;

export type StatusApplyResult = {
  published: number;
  unpublished: number;
  /** Mensajes para los warnings de la corrida; nunca lanza. */
  errors: string[];
};

export async function applyProductStatuses(
  container: MedusaContainer,
  changes: { publish: StatusChange[]; unpublish: StatusChange[] },
  chunkSize = STATUS_CHUNK
): Promise<StatusApplyResult> {
  const result: StatusApplyResult = { published: 0, unpublished: 0, errors: [] };
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const productService = container.resolve(Modules.PRODUCT) as unknown as {
    upsertProducts(data: Array<Record<string, unknown>>): Promise<unknown>;
  };

  const write = async (targets: StatusChange[], status: 'published' | 'draft'): Promise<number> => {
    let done = 0;
    for (let i = 0; i < targets.length; i += Math.max(chunkSize, 1)) {
      const chunk = targets.slice(i, i + Math.max(chunkSize, 1));
      try {
        await productService.upsertProducts(chunk.map(({ product_id }) => ({ id: product_id, status })));
        done += chunk.length;
      } catch (batchError) {
        // Una tanda no puede caer entera por una fila: se reintenta de a uno para
        // aislar la culpable. Mismo patrón que las updates de variante, y solo se
        // paga en el camino de error.
        logger.warn(
          `[erp] catalog sync: una tanda de ${chunk.length} cambio(s) de estado a ${status} falló ` +
            `(${truncateError(batchError)}); se reintenta de a uno.`
        );
        for (const change of chunk) {
          try {
            await productService.upsertProducts([{ id: change.product_id, status }]);
            done += 1;
          } catch (error) {
            result.errors.push(
              `No se pudo pasar a ${status} el producto ${change.product_id} ` +
                `(artículo ${change.codes.join(', ')}): ${truncateError(error)}`
            );
          }
        }
      }
    }
    return done;
  };

  result.published = await write(changes.publish, 'published');
  result.unpublished = await write(changes.unpublish, 'draft');
  return result;
}

/**
 * Todos los productos que el sync del ERP creó, indexados por código de artículo
 * (que es el SKU de la variante).
 *
 * Es un barrido COMPLETO de variantes, así que se llama solo cuando hace falta:
 * detectar los artículos BORRADOS de la gestión (`status_sync_unpublish_missing`)
 * necesita el complemento de lo que trajo el ERP, y eso no se puede pedir por
 * código. El filtro por dueño se hace en JS porque `query.graph` no filtra por
 * claves dentro de un JSON.
 */
export async function readErpOwnedProducts(
  container: MedusaContainer
): Promise<Map<string, StatusCandidate>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  type Row = {
    sku: string | null;
    product_id: string | null;
    metadata: Record<string, unknown> | null;
    product?: { id: string; status: string | null } | null;
  };

  const out = new Map<string, StatusCandidate>();
  for (let skip = 0; ; skip += OWNED_PAGE_SIZE) {
    const { data } = await query.graph({
      entity: 'product_variant',
      fields: ['sku', 'metadata', 'product_id', 'product.id', 'product.status'],
      pagination: { skip, take: OWNED_PAGE_SIZE, order: { id: 'ASC' } },
    });
    const variants = data as Row[];
    for (const variant of variants) {
      const sku = variant.sku?.trim();
      const productId = variant.product?.id ?? variant.product_id;
      if (!sku || !productId) continue;
      if (!isErpOwnedVariant(variant.metadata)) continue;
      // Si dos variantes comparten SKU el planner igual agrega por `product_id`,
      // así que quedarse con la primera no cambia la decisión.
      if (out.has(sku)) continue;
      out.set(sku, {
        product_id: productId,
        status: variant.product?.status ?? null,
        metadata: variant.metadata,
      });
    }
    if (variants.length < OWNED_PAGE_SIZE) break;
  }
  return out;
}
