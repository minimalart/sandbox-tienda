/**
 * Clasificación PURA de la asignación de categorías del ERP a productos
 * (testeable sin container).
 *
 * El modo es ADITIVO: el ERP administra ÚNICAMENTE las categorías que él mismo
 * creó — las que tienen `external_id = <provider>:<código>` — y jamás toca una
 * categoría puesta a mano.
 *
 * La categoría anterior del ERP se deduce de `erpOwnedCategoryIds`, NO de
 * `variant.metadata.zeus_categoria`: esa metadata se reescribe en la misma
 * corrida (así que leerla después da el valor nuevo), no existe en productos
 * que nunca pasaron por el sync, y miente si alguien recategorizó a mano. El
 * criterio por `external_id` es auto-descriptivo y auto-reparable.
 */

export type ProductCategoryState = {
  product_id: string;
  category_ids: string[];
};

export type CategoryArticleStatus =
  | 'linked'
  | 'unchanged'
  | 'unknown_code'
  | 'no_category'
  | 'no_product';

export type CategoryAssignmentPlan = {
  /** categoryId → productIds a linkear (ya filtrados: no la tienen). */
  add: Map<string, string[]>;
  /** categoryId → productIds a deslinkear (categoría del ERP que ya no corresponde). */
  remove: Map<string, string[]>;
  unchanged: number;
  /** Artículos con `categoria` vacía en el ERP: no se toca nada. */
  no_category: number;
  /** Artículos sin producto en Medusa (no existen o `create_products` apagado). */
  no_product: number;
  /** Códigos que el árbol del ERP no cubre → cuántos artículos los usan. */
  unknown_codes: Map<string, number>;
  /** Productos tocados, para sumarlos al reindex (el workflow de link no emite eventos). */
  touched_product_ids: Set<string>;
  /** `articleCode` → detalle para el `response_payload` del log item. */
  perArticle: Map<string, { status: CategoryArticleStatus; code: string | null; category_id?: string }>;
};

const push = (map: Map<string, string[]>, key: string, value: string): void => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export function planCategoryAssignments(input: {
  rows: Array<{ code: string; category_code: string | null }>;
  productsByCode: Map<string, ProductCategoryState>;
  categoryIdByCode: Map<string, string>;
  erpOwnedCategoryIds: Set<string>;
}): CategoryAssignmentPlan {
  const { rows, productsByCode, categoryIdByCode, erpOwnedCategoryIds } = input;

  const plan: CategoryAssignmentPlan = {
    add: new Map(),
    remove: new Map(),
    unchanged: 0,
    no_category: 0,
    no_product: 0,
    unknown_codes: new Map(),
    touched_product_ids: new Set(),
    perArticle: new Map(),
  };

  for (const row of rows) {
    // Se normaliza de nuevo acá por si la fila no pasó por el adapter (tests,
    // adapters futuros): el árbol siempre está en mayúsculas.
    const code = row.category_code ? row.category_code.trim().toUpperCase() : null;

    if (!code) {
      plan.no_category++;
      plan.perArticle.set(row.code, { status: 'no_category', code: null });
      continue;
    }

    const target = categoryIdByCode.get(code) ?? null;
    if (!target) {
      plan.unknown_codes.set(code, (plan.unknown_codes.get(code) ?? 0) + 1);
      plan.perArticle.set(row.code, { status: 'unknown_code', code });
      continue;
    }

    const state = productsByCode.get(row.code);
    if (!state) {
      plan.no_product++;
      plan.perArticle.set(row.code, { status: 'no_product', code });
      continue;
    }

    const hasTarget = state.category_ids.includes(target);
    const staleErp = state.category_ids.filter(
      (id) => id !== target && erpOwnedCategoryIds.has(id)
    );

    if (hasTarget && !staleErp.length) {
      plan.unchanged++;
      plan.perArticle.set(row.code, { status: 'unchanged', code, category_id: target });
      continue;
    }

    // Pre-filtrar es obligatorio: `batchLinkProductsToCategoryStep` hace
    // `[...existentes, id]` SIN dedupe, así que re-linkear duplicaría la fila.
    if (!hasTarget) push(plan.add, target, state.product_id);
    for (const stale of staleErp) push(plan.remove, stale, state.product_id);

    plan.touched_product_ids.add(state.product_id);
    plan.perArticle.set(row.code, { status: 'linked', code, category_id: target });
  }

  return plan;
}
