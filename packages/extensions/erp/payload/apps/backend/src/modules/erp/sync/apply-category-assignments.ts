import type { MedusaContainer } from '@medusajs/framework/types';
import { batchLinkProductsToCategoryWorkflow } from '@medusajs/medusa/core-flows';
import { truncateError } from '../sanitize';
import type { CategoryAssignmentPlan } from './plan-category-assignments';

/**
 * Lado de ESCRITURA de la asignación de categorías.
 *
 * `batchLinkProductsToCategoryWorkflow` es la única vía ADITIVA: agrega o saca
 * UNA categoría dejando intactas las demás del producto (verificado en
 * `core-flows/steps/batch-link-products-in-category.js`). `updateProductsWorkflow`
 * con `categories: [...]` REEMPLAZA el set completo y borraría la curaduría
 * manual.
 *
 * Dos avisos sobre ese workflow:
 * - su step hace un `listProducts` con TODOS los ids y `relations: ['categories']`
 *   en una sola query → hay que chunkear;
 * - no emite `product.updated`, así que el reindex de Typesense NO se dispara
 *   solo: los `touched_product_ids` del plan tienen que entrar al evento
 *   batcheado del final de la corrida.
 */

const CATEGORY_LINK_CHUNK = 200;

export type CategoryAssignmentApplyResult = {
  linksAdded: number;
  linksRemoved: number;
  errors: string[];
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export async function applyCategoryAssignments(
  container: MedusaContainer,
  plan: CategoryAssignmentPlan
): Promise<CategoryAssignmentApplyResult> {
  const result: CategoryAssignmentApplyResult = { linksAdded: 0, linksRemoved: 0, errors: [] };

  const run = async (
    categoryId: string,
    productIds: string[],
    mode: 'add' | 'remove'
  ): Promise<void> => {
    for (const batch of chunk(productIds, CATEGORY_LINK_CHUNK)) {
      try {
        await batchLinkProductsToCategoryWorkflow(container).run({
          input: {
            id: categoryId,
            ...(mode === 'add' ? { add: batch } : { remove: batch }),
          },
        });
        if (mode === 'add') result.linksAdded += batch.length;
        else result.linksRemoved += batch.length;
      } catch (error) {
        result.errors.push(
          `No se pudo ${mode === 'add' ? 'asignar' : 'quitar'} la categoría ${categoryId} en ${batch.length} producto(s): ${truncateError(error)}`
        );
      }
    }
  };

  // Los remove van primero para que un producto que cambia de categoría no
  // quede un instante en las dos.
  for (const [categoryId, productIds] of plan.remove) await run(categoryId, productIds, 'remove');
  for (const [categoryId, productIds] of plan.add) await run(categoryId, productIds, 'add');

  return result;
}
