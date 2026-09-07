"use client";

import { useProductsStore } from "@lib/stores";
import type { HttpTypes } from "@medusajs/types";
import { isProductInStock } from "@lib/util/is-product-in-stock";
import FeaturedProductCard from "@modules/home/components/featured-product-card";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import InfiniteScrollSentinel from "@modules/store/components/infinite-scroll-sentinel";
import ProductGridSkeleton from "@modules/store/components/product-grid-skeleton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LoadMoreProductsProps = {
  initialProducts: HttpTypes.StoreProduct[];
  initialPage: number;
  nextPage: number | null;
  totalPages: number;
  sortBy: SortOptions;
  countryCode: string;
  limit: number;
  region: HttpTypes.StoreRegion;
  filters?: {
    collectionId?: string;
    categoryId?: string;
    productIds?: string[];
  };
  searchQuery?: string;
};

const LoadMoreProducts = ({
  initialProducts,
  initialPage,
  nextPage,
  totalPages,
  sortBy,
  countryCode,
  limit,
  region,
  filters,
  searchQuery,
}: LoadMoreProductsProps) => {
  // Zustand store para productos
  const {
    products: storeProducts,
    setProducts,
    addProducts,
    isLoading,
    isLoadingMore,
    setLoading,
    setLoadingMore,
    error,
    setError,
    currentPage,
    setCurrentPage,
    setPagination,
  } = useProductsStore();

  const [next, setNext] = useState<number | null>(nextPage);

  // Crear una key única para detectar cambios en filtros
  const filterKey = `${filters?.categoryId}-${filters?.collectionId}-${searchQuery}-${sortBy}`;
  const prevFilterKey = useRef(filterKey);
  const isInitialized = useRef(false);

  // Usar productos del store si existen y los filtros no cambiaron, sino usar initialProducts
  const rawProducts =
    storeProducts.length > 0 && prevFilterKey.current === filterKey
      ? storeProducts
      : initialProducts;

  const products = useMemo(
    () =>
      [...rawProducts].sort((a, b) => {
        const aIn = isProductInStock(a);
        const bIn = isProductInStock(b);
        if (aIn === bIn) return 0;
        return aIn ? -1 : 1;
      }),
    [rawProducts],
  );

  // Sincronizar con el store cuando cambian los filtros o en el primer render
  useEffect(() => {
    const filtersChanged = prevFilterKey.current !== filterKey;

    if (!isInitialized.current || filtersChanged) {
      setProducts(initialProducts);
      setCurrentPage(initialPage);
      setPagination({ totalPages, totalCount: totalPages * limit });
      setNext(nextPage);
      setError(null);
      setLoading(false);
      prevFilterKey.current = filterKey;
      isInitialized.current = true;
    }
  }, [
    filterKey,
    initialProducts,
    initialPage,
    nextPage,
    totalPages,
    limit,
    setProducts,
    setCurrentPage,
    setPagination,
    setError,
    setLoading,
  ]);

  const buildQueryParams = useCallback(
    (pageToLoad: number) => {
      const params = new URLSearchParams({
        countryCode,
        sortBy,
        limit: limit.toString(),
        page: pageToLoad.toString(),
      });

      if (searchQuery) {
        params.set("q", searchQuery);
      }

      if (filters?.collectionId) {
        params.set("collectionId", filters.collectionId);
      }

      if (filters?.categoryId) {
        params.set("categoryId", filters.categoryId);
      }

      filters?.productIds?.forEach((id) => params.append("productsIds", id));

      return params.toString();
    },
    [
      countryCode,
      filters?.categoryId,
      filters?.collectionId,
      filters?.productIds,
      limit,
      sortBy,
      searchQuery,
    ],
  );

  const handleLoadMore = useCallback(async () => {
    if (!next || isLoading || isLoadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/store/products?${buildQueryParams(next)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load products");
      }

      const data: {
        products: HttpTypes.StoreProduct[];
        nextPage: number | null;
        currentPage: number;
      } = await response.json();

      addProducts(data.products);
      setCurrentPage(data.currentPage);
      setNext(data.nextPage);
    } catch (err) {
      console.error(err);
      setError("No pudimos cargar más productos. Intentá nuevamente.");
    } finally {
      setLoadingMore(false);
    }
  }, [
    next,
    isLoading,
    isLoadingMore,
    buildQueryParams,
    addProducts,
    setCurrentPage,
    setError,
    setLoadingMore,
  ]);

  return (
    <section className="bg-white" data-testid="products-list">
      <div className="mx-auto max-w-7xl px-0 py-8 sm:px-0 lg:px-0">
        <div className="grid grid-cols-2 justify-items-center gap-x-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 xl:gap-x-[8px]">
          {products.map((product) => (
            <FeaturedProductCard
              key={product.id}
              product={product}
              region={region}
            />
          ))}
        </div>

        {error && (
          <p className="mt-6 text-center text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}

        <InfiniteScrollSentinel
          disabled={!next || products.length === 0}
          isLoading={isLoading || isLoadingMore}
          onIntersect={handleLoadMore}
          rootMargin="0px 0px 400px 0px"
        >
          <ProductGridSkeleton />
        </InfiniteScrollSentinel>

        {!next && products.length > 0 && (
          <p
            aria-live="polite"
            className="mt-6 text-center text-gray-500 text-sm"
          >
            Ya viste todos los productos ({products.length} /{" "}
            {totalPages * limit}).
          </p>
        )}
      </div>
    </section>
  );
};

export default LoadMoreProducts;
