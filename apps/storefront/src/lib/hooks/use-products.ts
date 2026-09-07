"use client";

import { useProductsCache } from "@lib/context/products-cache-context";
import type { HttpTypes } from "@medusajs/types";
import { useMemo } from "react";

export function useProducts() {
  const { products, isLoading, isFullyCached, getProductById } = useProductsCache();

  return {
    products,
    isLoading,
    isFullyCached,
    getProductById,
    totalProducts: products.length,
  };
}

export function useProductsByIds(ids: string[]): {
  products: HttpTypes.StoreProduct[];
  isLoading: boolean;
  missingIds: string[];
} {
  const { products, isLoading, getProductById } = useProductsCache();

  const result = useMemo(() => {
    const foundProducts: HttpTypes.StoreProduct[] = [];
    const missing: string[] = [];

    ids.forEach((id) => {
      const product = getProductById(id);
      if (product) {
        foundProducts.push(product);
      } else {
        missing.push(id);
      }
    });

    return {
      products: foundProducts,
      missingIds: missing,
    };
  }, [ids, products, getProductById]);

  return {
    ...result,
    isLoading,
  };
}

export function useProductsByCategory(categoryId: string): {
  products: HttpTypes.StoreProduct[];
  isLoading: boolean;
} {
  const { products, isLoading } = useProductsCache();

  const filteredProducts = useMemo(() => {
    return products.filter((product) =>
      product.categories?.some((cat) => cat.id === categoryId)
    );
  }, [products, categoryId]);

  return {
    products: filteredProducts,
    isLoading,
  };
}

export function useSearchProducts(query: string): {
  products: HttpTypes.StoreProduct[];
  isLoading: boolean;
} {
  const { products, isLoading } = useProductsCache();

  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return products;
    }

    const lowerQuery = query.toLowerCase();
    return products.filter(
      (product) =>
        product.title?.toLowerCase().includes(lowerQuery) ||
        product.description?.toLowerCase().includes(lowerQuery) ||
        product.handle?.toLowerCase().includes(lowerQuery)
    );
  }, [products, query]);

  return {
    products: searchResults,
    isLoading,
  };
}
