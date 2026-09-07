import { MAX_FACET_VALUES } from "@lib/typesense/core/facets";
import { searchTypesenseProducts } from "@lib/typesense/products";
import { getCategoryDisplayName } from "@lib/util/category-display";
import type { HttpTypes } from "@medusajs/types";
import { cache } from "react";
import { listCategories } from "./categories";

/**
 * Nodo del menú "Categorías" del nav. Se arma en el server y llega al cliente ya
 * recortado a 2 niveles con el href resuelto, así el nav no vuelve a pedir nada
 * ni carga con el payload completo de categorías.
 */
export type NavCategoryNode = {
  id: string;
  name: string;
  href: string;
  children: NavCategoryNode[];
};

/** Nodo interno: el árbol COMPLETO, antes de podar y recortar a 2 niveles. */
type TreeNode = {
  id: string;
  name: string;
  children: TreeNode[];
};

/**
 * Conteos del canal por id de categoría y, como respaldo, por nombre.
 *
 * El id es la clave correcta: las `product_category` de Medusa son GLOBALES, así
 * que dos tiendas del mismo backend pueden tener categorías con el mismo nombre
 * (p. ej. "Complementos" en el árbol de un ERP de pinturería y en
 * "Almacén > Repostería y postres" de un catálogo de supermercado). Podando por
 * nombre, el conteo de una hace sobrevivir la rama entera de la otra y el menú
 * termina ofreciendo rubros de otro catálogo.
 *
 * `byName` sólo se usa si el facet de ids no vino (colección vieja sin
 * `categories.id` faceteable): ahí se prefiere el comportamiento anterior a
 * dejar el menú vacío.
 */
type ChannelCategoryCounts = {
  byId: Map<string, number>;
  byName: Map<string, number>;
};

const countForNode = (node: TreeNode, counts: ChannelCategoryCounts): number =>
  counts.byId.size > 0
    ? (counts.byId.get(node.id) ?? 0)
    : (counts.byName.get(node.name) ?? 0);

/** Niveles que muestran las dos variantes del menú (raíz + hijos). */
const NAV_DEPTH = 2;

/**
 * Si el facet de categorías llega justo al tope que pidió la búsqueda, Typesense
 * truncó valores y podar por conteo escondería categorías que sí tienen
 * productos: en ese caso se prefiere no podar.
 *
 * Se lee la MISMA constante que usa el request. Cuando estaban duplicadas y el
 * catálogo creció, este guard apagó la poda en silencio.
 */
const FACET_VALUES_CAP = MAX_FACET_VALUES;

/**
 * Arma el árbol COMPLETO desde la lista plana de Medusa.
 *
 * Se une por `parent_category_id` en vez de confiar en `category_children`: las
 * referencias anidadas no siempre traen sus propios hijos populados (depende de
 * cómo expandió `fields`), el mismo motivo por el que la PLP reconstruye el árbol.
 */
const buildTree = (flat: HttpTypes.StoreProductCategory[]): TreeNode[] => {
  const nodes = new Map<string, TreeNode>();
  for (const cat of flat) {
    if (!cat.name) continue;
    nodes.set(cat.id, { id: cat.id, name: cat.name, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const cat of flat) {
    const node = nodes.get(cat.id);
    if (!node) continue;
    const parentId = cat.parent_category_id ?? cat.parent_category?.id ?? null;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
      continue;
    }
    roots.push(node);
  }
  return roots;
};

/**
 * Conteos de productos por categoría en el canal activo, leídos de los facets de
 * Typesense — la misma fuente con la que la PLP decide qué categorías mostrar.
 * Las categorías de Medusa no están scopeadas por sales channel, así que sin
 * esto el menú listaba el catálogo de todas las tiendas.
 *
 * Devuelve `null` si no se puede confiar en los conteos (error, ambos facets
 * ausentes o truncados por el tope): en ese caso el menú se muestra sin podar,
 * que es mejor que esconder categorías reales.
 */
const getChannelCategoryCounts = cache(
  async (): Promise<ChannelCategoryCounts | null> => {
    try {
      // limit 1: sólo interesan las facetas. El canal lo resuelve el wrapper
      // server (demo → cookie de sucursal → default), igual que la PLP.
      const { facetCounts } = await searchTypesenseProducts({
        q: "*",
        limit: 1,
        facets: true,
      });

      const readFacet = (field: string): Map<string, number> | null => {
        const facet = facetCounts.find((f) => f.field_name === field);
        if (!facet || facet.counts.length === 0) return null;
        // Si el facet llegó justo al tope, Typesense truncó valores y podar
        // escondería categorías que sí tienen productos.
        if (facet.counts.length >= FACET_VALUES_CAP) return null;
        const counts = new Map<string, number>();
        for (const { value, count } of facet.counts) counts.set(value, count);
        return counts;
      };

      const byId = readFacet("categories.id");
      const byName = readFacet("categories.name");
      if (!byId && !byName) return null;
      return { byId: byId ?? new Map(), byName: byName ?? new Map() };
    } catch (error) {
      console.warn(
        "[NAV] No se pudieron leer los conteos de categorías por canal:",
        error
      );
      return null;
    }
  }
);

/**
 * Poda el árbol dejando sólo las ramas con productos en el canal.
 *
 * El facet cuenta la categoría DIRECTA de cada producto (las hojas), así que un
 * nodo se conserva si tiene conteo propio o si algún descendiente lo tiene. Por
 * eso se poda sobre el árbol completo ANTES de recortar a 2 niveles: si no, un
 * rubro cuyos productos cuelgan del tercer nivel se descartaría entero.
 */
const pruneToChannel = (
  nodes: TreeNode[],
  counts: ChannelCategoryCounts
): TreeNode[] =>
  nodes
    .map((node) => ({
      ...node,
      children: pruneToChannel(node.children, counts),
    }))
    .filter((node) => countForNode(node, counts) > 0 || node.children.length > 0);

/**
 * Recorta a `NAV_DEPTH` niveles y resuelve el href. Los links caen en la PLP
 * filtrada por nombre, el mismo formato que usan los filtros de la tienda (que
 * resuelven contra el facet de Typesense y expanden el filtro a las hojas, así
 * que el link del padre igual alcanza a los niveles que el menú no muestra).
 *
 * El nombre se formatea con el mismo helper que la barra de filtros
 * (`getCategoryDisplayName`), así los catálogos de ERP dejan de gritar en
 * MAYÚSCULAS. Ojo: sólo el label — el `category` del href tiene que seguir
 * siendo el nombre crudo o el filtro de Typesense no matchea nada.
 */
const toNavNodes = (nodes: TreeNode[], depth = NAV_DEPTH): NavCategoryNode[] =>
  nodes.map((node) => ({
    id: node.id,
    name: getCategoryDisplayName(node.name),
    href: `/store?category=${encodeURIComponent(node.name)}`,
    children: depth > 1 ? toNavNodes(node.children, depth - 1) : [],
  }));

/**
 * Árbol para el menú "Categorías" del nav, limitado a las categorías con
 * productos en el canal activo. El menú es opcional (config por demo) y nunca
 * debe tirar el layout: si algo falla se devuelve vacío o sin podar y el nav se
 * pinta igual. `listCategories` está cacheado 5 minutos.
 */
export const getNavCategories = async (): Promise<NavCategoryNode[]> => {
  try {
    const [flat, counts] = await Promise.all([
      listCategories(),
      getChannelCategoryCounts(),
    ]);
    const tree = buildTree(flat);
    return toNavNodes(counts ? pruneToChannel(tree, counts) : tree);
  } catch {
    return [];
  }
};
