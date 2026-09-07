import { getRegion } from "@lib/data/regions";
import { listProducts } from "@lib/repositories/products.repository";
import LoadMoreProducts from "@modules/store/components/load-more-products";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";

const PRODUCT_LIMIT = 12;

interface PaginatedProductsProps {
  sortBy?: SortOptions;
  page: number;
  collectionId?: string;
  categoryId?: string;
  productsIds?: string[];
  countryCode: string;
  searchQuery?: string;
}

export default async function PaginatedProducts({
  sortBy = "created_at",
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  searchQuery,
}: PaginatedProductsProps) {
  const region = await getRegion(countryCode);

  if (!region) {
    return null;
  }

  // Usar el repositorio directamente (Server Component)
  const { products, totalPages, nextPage } = await listProducts({
    page,
    limit: PRODUCT_LIMIT,
    sortBy,
    countryCode,
    categoryId,
    collectionId,
    productIds: productsIds,
    searchQuery,
  });

  return (
    <LoadMoreProducts
      countryCode={countryCode}
      filters={{
        collectionId,
        categoryId,
        productIds: productsIds,
      }}
      initialPage={page}
      initialProducts={products}
      limit={PRODUCT_LIMIT}
      nextPage={nextPage}
      region={region}
      searchQuery={searchQuery}
      sortBy={sortBy}
      totalPages={totalPages}
    />
  );
}
