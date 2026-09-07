type QueryGraph = { graph: (input: unknown) => Promise<{ data: unknown[] }> };
type CategoryNode = { id: string; parent_category_id: string | null };

/**
 * Ids de una categoría MÁS todos sus descendientes.
 *
 * Hace falta porque renombrar o re-parentear una categoría cambia
 * `categories.name`, `categories.lvl0/1/2` y `category_path_label` de TODOS los
 * productos que cuelgan debajo, no sólo de los que la tienen asignada directo.
 */
export async function resolveCategorySubtreeIds(
  query: QueryGraph,
  categoryIds: string[],
): Promise<string[]> {
  const roots = categoryIds.filter(Boolean);
  if (roots.length === 0) return [];

  let all: CategoryNode[] = [];
  try {
    const { data } = (await query.graph({
      entity: 'product_category',
      fields: ['id', 'parent_category_id'],
    })) as { data: CategoryNode[] };
    all = data;
  } catch {
    // Sin el árbol nos quedamos con las categorías pedidas: mejor reindexar de
    // menos que fallar el subscriber entero.
    return [...new Set(roots)];
  }

  const childrenByParent = new Map<string, string[]>();
  for (const node of all) {
    if (!node.parent_category_id) continue;
    const siblings = childrenByParent.get(node.parent_category_id) ?? [];
    siblings.push(node.id);
    childrenByParent.set(node.parent_category_id, siblings);
  }

  const result = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue; // corta ciclos además de repetidos
    result.add(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child);
  }
  return [...result];
}

/** Product ids ligados a cualquiera de las categorías indicadas. */
export async function resolveProductIdsInCategories(
  query: QueryGraph,
  categoryIds: string[],
): Promise<string[]> {
  if (categoryIds.length === 0) return [];
  const ids = new Set<string>();
  const PAGE = 200;
  for (let skip = 0; ; skip += PAGE) {
    let products: Array<{ id?: string | null }> = [];
    try {
      const { data } = (await query.graph({
        entity: 'product',
        fields: ['id'],
        filters: { categories: { id: categoryIds } },
        pagination: { skip, take: PAGE, order: { id: 'ASC' } },
      })) as { data: Array<{ id?: string | null }> };
      products = data;
    } catch {
      break;
    }
    for (const product of products) {
      if (product.id) ids.add(product.id);
    }
    if (products.length < PAGE) break;
  }
  return [...ids];
}
