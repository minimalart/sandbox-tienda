// Barrel del módulo Typesense.
// Re-exporta el wrapper servidor y los tipos públicos.
// NO re-exporta search-core ni search-browser — los hooks cliente importan
// directamente desde @lib/typesense/search-browser para no arrastrar el
// wrapper servidor (y su `import "server-only"`) al bundle del cliente.

export {
  default as typesenseClient,
  TYPESENSE_COLLECTION_NAME,
  TYPESENSE_SEARCH_PRESET,
} from "./client";
export { searchTypesenseProducts } from "./products";
export type {
  TypesenseProductsParams,
  TypesenseProductsResponse,
  TypesenseProductDocument,
  TypesenseCategoryRef,
  TypesenseFacetCount,
  SortOption,
} from "./types";
export { getProductStockFromTypesense } from "./get-product-stock";
export { getProductDataFromTypesense } from "./get-product-data";
