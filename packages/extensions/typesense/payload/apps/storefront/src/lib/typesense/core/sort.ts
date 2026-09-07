// Constantes y función de ordenamiento para búsquedas Typesense.
// Sin importaciones externas.

import type { SortOption } from "../types";

// Ordenamiento por defecto: primero productos con stock, luego
// mayor `metadata.ranking`, los sin ranking al fondo, empates por
// creación más reciente. Requiere que `metadata.ranking` sea un campo
// numérico sorteable (sort: true) en el schema de Typesense.
export const STOCK_PRIORITY = "_eval(stock_available:>0):desc";
export const DEFAULT_SORT_BY = `${STOCK_PRIORITY},metadata.ranking(missing_values: last):desc,created_at:desc`;

export function buildSortBy(sortBy?: SortOption): string {
  switch (sortBy) {
    case "relevance":
      // NO usar `_text_match(buckets: N)` acá: anula la escalera de pesos de
      // `query-by.ts`.
      //
      // El efecto de los pesos vive DENTRO del text match score. Cuantizarlo en
      // escalones empata productos que la escalera había separado a propósito, y
      // el desempate pasa a `metadata.ranking` — o sea que un match por CATEGORÍA
      // (peso 25) puede ganarle a un match por TÍTULO (peso 100), que es
      // exactamente el problema que la escalera existe para evitar.
      //
      // Medido contra un catálogo real de 5041 productos, top-6:
      //   sin buckets → 30/30 resultados matchean por título
      //   con buckets → 28/30, y en 2 de 2 casos comprobables un match sólo-por-
      //                 categoría se cuela por delante de uno por título
      //                 ("remera" → una Blusa de la categoría "Remeras y camisas"
      //                 queda #3, delante de "Remera técnica bicolor")
      //
      // Ojo: esos productos NO están mal categorizados ni son irrelevantes; el
      // problema es el ORDEN. P@1, P@5 y MRR no distinguen los dos casos, así que
      // no alcanza con mirar esas métricas para decidir esto.
      //
      // El parámetro sí existe en 27.1 (indocumentado en esa versión): se descarta
      // por evidencia, no por incompatibilidad. `bucket_size` es v28+.
      //
      // Tope duro de Typesense: 3 sort fields. Esta rama ya está en el límite.
      return `${STOCK_PRIORITY},_text_match:desc,metadata.ranking(missing_values: last):desc`;
    case "price_asc":
      return `${STOCK_PRIORITY},price:asc`;
    case "price_desc":
      return `${STOCK_PRIORITY},price:desc`;
    case "created_at":
      return `${STOCK_PRIORITY},created_at:desc`;
    case "ranking":
      return DEFAULT_SORT_BY;
    default:
      return DEFAULT_SORT_BY;
  }
}
