/**
 * Construye la cadena completa de ancestros (`_full_path`) de cada categoría y
 * la adjunta a las categorías de un producto, para que el ProductMapper genere
 * facets jerárquicos correctos (categories.lvl0/lvl1/lvl2 + category_path).
 *
 * Antes esto solo lo hacía el full-sync (scripts/typesense-sync.ts): los
 * subscribers incrementales (product.created/updated) traían solo 1 nivel de
 * `parent_category`, así que al editar un producto su jerarquía quedaba
 * incompleta y la indexación se degradaba con el tiempo. Centralizar la lógica
 * acá garantiza que ambos caminos indexen idéntico.
 */

type QueryGraph = { graph: (input: unknown) => Promise<{ data: unknown[] }> };
type CategoryNode = { id: string; name: string; parent_category_id: string | null };
type CategoryPath = Array<{ id: string; name: string }>;

export type CategoryPathMap = Map<string, CategoryPath>;

/** Mapa categoría.id → ruta de ancestros [raíz, …, hoja]. */
export async function buildCategoryPathMap(query: QueryGraph): Promise<CategoryPathMap> {
  const map: CategoryPathMap = new Map();
  try {
    const { data } = (await query.graph({
      entity: 'product_category',
      fields: ['id', 'name', 'parent_category_id'],
    })) as { data: CategoryNode[] };

    const byId = new Map<string, CategoryNode>(data.map((c) => [c.id, c]));

    const resolve = (id: string): CategoryPath => {
      const cached = map.get(id);
      if (cached) return cached;
      const chain: CategoryPath = [];
      const seen = new Set<string>();
      let cursor: string | null = id;
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const node = byId.get(cursor);
        if (!node) break;
        chain.unshift({ id: node.id, name: node.name });
        cursor = node.parent_category_id;
      }
      map.set(id, chain);
      return chain;
    };

    for (const c of data) resolve(c.id);
  } catch {
    // Si falla, se devuelve mapa vacío: el mapper cae a caminar parent_category.
  }
  return map;
}

/** Devuelve una copia del producto con `_full_path` en cada categoría. */
export function attachCategoryFullPaths<T extends Record<string, unknown>>(
  product: T,
  pathMap: CategoryPathMap,
): T {
  const categories = Array.isArray(product.categories)
    ? (product.categories as Array<Record<string, unknown>>)
    : [];
  if (categories.length === 0) return product;
  return {
    ...product,
    categories: categories.map((cat) => ({
      ...cat,
      _full_path: pathMap.get(cat.id as string) ?? cat._full_path ?? null,
    })),
  };
}
