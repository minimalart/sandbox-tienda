// Configuración de relevancia para búsquedas Typesense.
// Sin importaciones externas.
//
// FUENTE DE VERDAD de la relevancia del buscador. `apps/backend/src/modules/
// typesense/search-defaults.ts` (que usa el buscador del admin) espeja este
// archivo; hay un test de paridad que falla si divergen.
//
// POR QUÉ LOS PESOS IMPORTAN ACÁ: con `text_match_type: max_score` (el default
// de Typesense) los field weights se usan SOLO como desempate entre documentos
// con el mismo text match score. Si varios campos comparten peso, el desempate
// es una constante y los pesos no hacen nada: buscar "remera" empata el producto
// titulado "Remera Oversize" con los 200 productos de la categoría "Remeras", y
// el orden real termina decidiéndolo `metadata.ranking`. De ahí la escalera de
// abajo: cada campo tiene un peso DISTINTO, ordenado por intención de búsqueda.

export type QueryByField = {
  /** Nombre del campo en el schema de Typesense. Debe existir e `index: true`. */
  field: string;
  /** Desempate bajo `max_score`. Solo importa el orden relativo; mantener ≤100. */
  weight: number;
  /** Typos tolerados en ESTE campo. */
  numTypos: 0 | 1 | 2;
  /** Prefix match en ESTE campo (Typesense lo aplica solo al último token). */
  prefix: boolean;
};

// El orden es significativo: es peso implícito además del explícito.
export const QUERY_BY_FIELDS: readonly QueryByField[] = [
  // Intención primaria del comprador.
  { field: "title", weight: 100, numTypos: 2, prefix: true },
  // Identificador: exacto o nada. `numTypos: 0` + el flag
  // `enable_typos_for_alpha_numerical_tokens: false` de search-core es lo que
  // hace seguro este peso alto — sin eso, un match fuzzy sobre cualquiera de los
  // N SKUs de un producto le ganaría a un match de título.
  { field: "variants.sku", weight: 90, numTypos: 0, prefix: true },
  // "adidas" debe traer la marca, no un título que la menciona al pasar.
  // numTypos 1: sobre nombres cortos ("Nike"), 2 typos llevan a cualquier parte.
  { field: "brand.name", weight: 60, numTypos: 1, prefix: true },
  { field: "tags.value", weight: 40, numTypos: 1, prefix: true },
  { field: "collection.title", weight: 30, numTypos: 1, prefix: true },
  // 25 y no 10: ESTE es el desempate que rompe el empate masivo por categoría.
  // No se saca del todo porque es el único camino para queries puramente de
  // categoría ("limpieza", "indumentaria").
  { field: "categories.name", weight: 25, numTypos: 1, prefix: true },
  // Talle/color: "remera negra", "talle m". numTypos 0 — son valores cortos y
  // cerrados, un typo acá genera más ruido que recall.
  { field: "options.values", weight: 20, numTypos: 0, prefix: true },
  { field: "categories.parent_category.name", weight: 15, numTypos: 1, prefix: true },
  { field: "variants.title", weight: 12, numTypos: 1, prefix: true },
  { field: "subtitle", weight: 8, numTypos: 1, prefix: true },
  // Aporta recall para queries descriptivas ("antihumedad") pero NO puede
  // fabricar matches: bajo `max_score` una descripción larga acumula score por
  // solapamiento de tokens y le ganaría a un match de título, y el peso bajo
  // solo desempata — no frena eso. Cortar typos y prefix es la mitigación real.
  { field: "description", weight: 3, numTypos: 0, prefix: false },
];

// NOTA: `handle` queda deliberadamente afuera. Con `token_separators` vacío en el
// schema, Typesense sólo separa por espacio, así que "remera-oversize-negra" es
// UN token y "remera" no matchea salvo como prefijo del slug entero. Incluirlo
// cuesta CPU sin aportar recall hasta que el schema agregue `token_separators`.
//
// NOTA: los campos de perfumería (`fragrance.name`, `olfactory_family.name`,
// `usage_suggestion.name`) se removieron: no existen en el schema ni los emite
// el mapper — eran de otro vertical, y estaban detrás de un gate por schema que
// nunca se cumplía porque el storefront no puede introspeccionar el schema.

/**
 * Deriva los cuatro parámetros paralelos que espera Typesense desde una sola
 * fuente. Derivarlos (en vez de mantener cuatro arrays a mano) hace imposible
 * la desalineación, que Typesense castiga con un 400.
 */
export function buildQueryByFields(): {
  queryBy: string;
  weights: string;
  numTypos: string;
  prefix: string;
} {
  return {
    queryBy: QUERY_BY_FIELDS.map((f) => f.field).join(","),
    weights: QUERY_BY_FIELDS.map((f) => String(f.weight)).join(","),
    numTypos: QUERY_BY_FIELDS.map((f) => String(f.numTypos)).join(","),
    prefix: QUERY_BY_FIELDS.map((f) => String(f.prefix)).join(","),
  };
}
