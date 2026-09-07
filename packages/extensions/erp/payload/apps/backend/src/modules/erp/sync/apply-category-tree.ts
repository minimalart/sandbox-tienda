import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import {
  createProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
} from '@medusajs/medusa/core-flows';
import { truncateError } from '../sanitize';
import {
  isErpOwned,
  type CategoryTreePlan,
  type ExistingCategory,
} from './plan-category-tree';

/**
 * Lado de ESCRITURA del espejo de categorías. La decisión la toma
 * `planCategoryTree` (pura); acá solo se ejecuta.
 *
 * NUNCA lanza: el árbol de categorías es secundario a los precios y al stock.
 * Un fallo acá vuelve como `errors` y el motor lo deja como warning de la
 * corrida en vez de marcarla fallida.
 */

const CATEGORY_PAGE_SIZE = 500;

/** Todas las `product_category`, paginadas (no hay techo de `take` arbitrario). */
export async function readExistingCategories(
  container: MedusaContainer
): Promise<ExistingCategory[]> {
  const productService = container.resolve(Modules.PRODUCT) as unknown as {
    listProductCategories(
      filters: Record<string, unknown>,
      config: Record<string, unknown>
    ): Promise<ExistingCategory[]>;
  };

  const out: ExistingCategory[] = [];
  for (let skip = 0; ; skip += CATEGORY_PAGE_SIZE) {
    const page = await productService.listProductCategories(
      {},
      {
        select: [
          'id',
          'name',
          'handle',
          'external_id',
          'parent_category_id',
          'rank',
          'metadata',
          'created_at',
        ],
        take: CATEGORY_PAGE_SIZE,
        skip,
      }
    );
    out.push(...page);
    if (page.length < CATEGORY_PAGE_SIZE) break;
  }
  return out;
}

export type CategoryTreeApplyResult = {
  /** `code` → id de Medusa, incluyendo lo recién creado. */
  categoryIdByCode: Map<string, string>;
  /** Ids de TODAS las categorías que administra el ERP (base del diff aditivo). */
  erpOwnedCategoryIds: Set<string>;
  created: number;
  updated: number;
  errors: string[];
};

export async function applyCategoryTree(
  container: MedusaContainer,
  plan: CategoryTreePlan,
  provider: string,
  existing: ExistingCategory[]
): Promise<CategoryTreeApplyResult> {
  const result: CategoryTreeApplyResult = {
    categoryIdByCode: new Map(plan.resolved),
    erpOwnedCategoryIds: new Set(
      existing.filter((c) => isErpOwned(c.external_id, provider)).map((c) => c.id)
    ),
    created: 0,
    updated: 0,
    errors: [],
  };

  // ── Altas, un nivel por llamada ────────────────────────────────────────────
  // El `parent_category_id` se resuelve recién acá: los ids del nivel anterior
  // no existían cuando se planificó. El `rank` se manda solo en el alta —
  // creando los hermanos en orden dentro del mismo batch — porque en un update
  // el módulo de producto re-rankea a todos los hermanos, incluidas las
  // categorías puestas a mano.
  for (const bucket of plan.creates) {
    const ordered = [...bucket].sort((a, b) => a.rank - b.rank);
    try {
      const { result: created } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: ordered.map((category) => ({
            name: category.name,
            handle: category.handle,
            is_active: true,
            external_id: category.external_id,
            metadata: category.metadata,
            ...(category.parent_code
              ? { parent_category_id: result.categoryIdByCode.get(category.parent_code) ?? undefined }
              : {}),
          })) as never,
        },
      });

      const rows = (created ?? []) as Array<{
        id: string;
        external_id?: string | null;
        handle?: string | null;
      }>;
      for (const row of rows) {
        // Por `external_id`, con fallback a `handle`: el handle es único en
        // Medusa y el workflow lo devuelve aunque recorte otros campos.
        const match =
          ordered.find((c) => c.external_id === row.external_id) ??
          ordered.find((c) => c.handle === row.handle);
        if (match) result.categoryIdByCode.set(match.code, row.id);
        result.erpOwnedCategoryIds.add(row.id);
      }
      result.created += rows.length;
    } catch (error) {
      result.errors.push(`No se pudieron crear categorías del ERP: ${truncateError(error)}`);
    }
  }

  // ── Updates, uno por nodo cambiado (≤ tamaño del árbol; en régimen, cero) ───
  for (const update of plan.updates) {
    const patch: Record<string, unknown> = { ...update.patch };
    if (update.changed.includes('parent_category_id')) {
      const parentId = update.parent_code
        ? (result.categoryIdByCode.get(update.parent_code) ?? null)
        : null;
      // Si el padre no se pudo crear, se deja la jerarquía como está en vez de
      // subir el nodo a la raíz.
      if (update.parent_code && !parentId) {
        result.errors.push(
          `No se pudo reubicar la categoría ${update.code}: su padre ${update.parent_code} no existe en Medusa.`
        );
      } else {
        patch.parent_category_id = parentId;
      }
    }
    if (!Object.keys(patch).length) continue;

    try {
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: update.id }, update: patch as never },
      });
      result.updated++;
    } catch (error) {
      result.errors.push(
        `No se pudo actualizar la categoría ${update.code}: ${truncateError(error)}`
      );
    }
  }

  return result;
}
