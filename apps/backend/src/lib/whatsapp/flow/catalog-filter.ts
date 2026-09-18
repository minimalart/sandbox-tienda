/**
 * ELEGIR PRODUCTOS POR LO QUE SON, NO DE A UNO.
 *
 * "Mostrar productos elegidos a mano" obliga a listar ids: sirve para una selección
 * curada de cinco y no sirve para "las ofertas", "todo lo de pinturas" o "lo que sale
 * menos de 20.000" — que son las tres cosas que un recorrido real quiere mostrar, y
 * que además cambian solas cuando cambia el catálogo. Un recorrido con ids adentro
 * envejece: el producto se discontinúa y el paso sigue ofreciéndolo.
 *
 * Esto traduce un filtro DECLARATIVO —lo que el operador arma con un par de selects—
 * al `filter_by` de Typesense. Es puro, así que las reglas se testean sin red.
 *
 * Los campos que se ofrecen son los que el índice ya tiene facetados (`schema.ts`):
 * categoría, colección, marca, precio y promoción. No se acepta un `filter_by` escrito
 * a mano a propósito: sería dejar que el editor mande sintaxis de Typesense al índice,
 * y cualquier error recién se vería con un cliente adelante.
 */

import { baseFilters } from '../advisor/filters';

export type WaCatalogFilter = {
  /** Ids de categoría. Incluye las hijas: se filtra por `category_path_ids`. */
  categoryIds?: string[];
  collectionIds?: string[];
  brandIds?: string[];
  /** En la moneda de la tienda, como lo indexa `price`. */
  priceMin?: number;
  priceMax?: number;
  /** Sólo lo que tiene promoción activa. */
  onlyPromotions?: boolean;
  sort?: 'relevancia' | 'precio_asc' | 'precio_desc';
};

const ids = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((v) => String(v ?? '').trim()).filter((v) => v !== '')
    : [];

const numero = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Un filtro que no filtra nada devolvería el catálogo entero: se trata aparte. */
export function isEmptyCatalogFilter(filter: WaCatalogFilter | null | undefined): boolean {
  if (!filter) return true;
  return (
    ids(filter.categoryIds).length === 0 &&
    ids(filter.collectionIds).length === 0 &&
    ids(filter.brandIds).length === 0 &&
    numero(filter.priceMin) === null &&
    numero(filter.priceMax) === null &&
    filter.onlyPromotions !== true
  );
}

/**
 * El `filter_by` completo.
 *
 * Arranca SIEMPRE por los filtros base —canal de venta del bot y productos ocultos—,
 * los mismos que usa el asesor guiado. Sin ellos el paso podría ofrecer algo que
 * después rebota en el carrito, que es el peor momento para enterarse.
 *
 * Las categorías van por `category_path_ids` y no por `category_id`: elegir "Pinturas"
 * tiene que traer lo que cuelga de Pinturas, no sólo lo colgado exactamente ahí. Es lo
 * que espera cualquiera que arma el filtro mirando el árbol.
 */
export function buildCatalogFilterBy(
  filter: WaCatalogFilter,
  salesChannelIds: string[],
): string {
  const clauses = [...baseFilters(salesChannelIds)];

  const categorias = ids(filter.categoryIds);
  if (categorias.length) clauses.push(`category_path_ids:=[${categorias.join(',')}]`);

  const colecciones = ids(filter.collectionIds);
  if (colecciones.length) clauses.push(`collection.id:=[${colecciones.join(',')}]`);

  const marcas = ids(filter.brandIds);
  if (marcas.length) clauses.push(`brand.id:=[${marcas.join(',')}]`);

  const min = numero(filter.priceMin);
  const max = numero(filter.priceMax);
  // Dos cláusulas y no un rango `[min..max]`: así cada extremo es opcional por su
  // cuenta, que es como se usa ("hasta 20.000" sin mínimo es lo más pedido).
  if (min !== null) clauses.push(`price:>=${min}`);
  if (max !== null) clauses.push(`price:<=${max}`);

  if (filter.onlyPromotions === true) clauses.push('has_promotion:=true');

  return clauses.join(' && ');
}

/**
 * El `sort_by`, o `undefined` para dejar mandar a la relevancia.
 *
 * Con una búsqueda por texto, ordenar por precio pisa la relevancia y el primer
 * resultado deja de tener que ver con lo que el cliente pidió. Acá no hay texto —el
 * paso muestra una selección— así que ordenar por precio es exactamente lo que se
 * quiere para "las ofertas más baratas".
 */
export function catalogSortBy(filter: WaCatalogFilter): string | undefined {
  if (filter.sort === 'precio_asc') return 'price:asc';
  if (filter.sort === 'precio_desc') return 'price:desc';
  return undefined;
}
