"use client";

import type { HttpTypes } from "@medusajs/types";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import { useCallback, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

export interface ProductsResponse {
  products: HttpTypes.StoreProduct[];
  count: number;
  currentPage: number;
  totalPages: number;
  nextPage: number | null;
  prevPage: number | null;
}

export interface UseProductsOptions {
  countryCode: string;
  sortBy?: SortOptions;
  limit?: number;
  categoryId?: string;
  collectionId?: string;
  searchQuery?: string;
}

export interface UseProductsReturn {
  products: HttpTypes.StoreProduct[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  loadMore: () => Promise<void>;
  loadPage: (page: number) => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useProducts(options: UseProductsOptions): UseProductsReturn {
  const {
    countryCode,
    sortBy = "created_at",
    limit = 12,
    categoryId,
    collectionId,
    searchQuery,
  } = options;

  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);

  const buildQueryParams = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        countryCode,
        sortBy,
        limit: limit.toString(),
        page: page.toString(),
      });

      if (categoryId) {
        params.set("categoryId", categoryId);
      }

      if (collectionId) {
        params.set("collectionId", collectionId);
      }

      if (searchQuery) {
        params.set("q", searchQuery);
      }

      return params.toString();
    },
    [countryCode, sortBy, limit, categoryId, collectionId, searchQuery]
  );

  const fetchProducts = useCallback(
    async (page: number, append = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/store/products?${buildQueryParams(page)}`);

        if (!response.ok) {
          throw new Error("Failed to load products");
        }

        const data: ProductsResponse = await response.json();

        setProducts((prev) => (append ? [...prev, ...data.products] : data.products));
        setCurrentPage(data.currentPage);
        setTotalPages(data.totalPages);
        setNextPage(data.nextPage);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error loading products";
        setError(message);
        console.error("[useProducts] Error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [buildQueryParams]
  );

  const loadMore = useCallback(async () => {
    if (nextPage && !isLoading) {
      await fetchProducts(nextPage, true);
    }
  }, [nextPage, isLoading, fetchProducts]);

  const loadPage = useCallback(
    async (page: number) => {
      if (!isLoading) {
        await fetchProducts(page, false);
      }
    },
    [isLoading, fetchProducts]
  );

  const refresh = useCallback(async () => {
    await fetchProducts(1, false);
  }, [fetchProducts]);

  return {
    products,
    isLoading,
    error,
    currentPage,
    totalPages,
    hasNextPage: nextPage !== null,
    hasPrevPage: currentPage > 1,
    loadMore,
    loadPage,
    refresh,
  };
}
