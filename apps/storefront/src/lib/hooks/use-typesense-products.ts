"use client";

import {
  searchProductsFromBrowser,
  trackSearchClient,
} from "@lib/typesense/search-browser";
import { useChannelSafe } from "@lib/context/channel-context";
import type {
  SortOption,
  TypesenseFacetCount,
  TypesenseProductDocument,
} from "@lib/typesense";
import { useCallback, useEffect, useRef, useState } from "react";

export type UseTypesenseProductsParams = {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: SortOption;
  category?: string;
  categoryNames?: string[];
  collection?: string;
  brand?: string;
  /** Familia libre del ERP; ver `family.name` en el índice. */
  family?: string;
  tag?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  promotion?: string;
  onlyPromotions?: boolean;
  fragancia?: string;
  sugerenciaUso?: string;
  familiaOlfativa?: string;
  /** Atributos del asesor guiado (`advisor_*`); ver `core/filters.ts`. */
  advisorSurface?: string;
  advisorProductType?: string;
  advisorEnvironment?: string;
  advisorSpecialUse?: string;
  advisorBase?: string;
  salesChannelId?: string;
  productIds?: string[];
  facets?: boolean;
  omitPriceFilter?: boolean;
};

export type UseTypesenseProductsState = {
  products: TypesenseProductDocument[];
  found: number;
  page: number;
  totalPages: number;
  facetCounts: TypesenseFacetCount[];
  facetUniverse: TypesenseFacetCount[];
  /**
   * Cuántos productos matchea la query sin los filtros del usuario. Permite que
   * el estado vacío ofrezca "quitar filtros" en vez de un callejón sin salida.
   * `null` cuando no había filtros activos.
   */
  unfilteredFound: number | null;
  isLoading: boolean;
  error: string | null;
};

export type UseTypesenseProductsActions = {
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useTypesenseProducts(
  params: UseTypesenseProductsParams,
): UseTypesenseProductsState & UseTypesenseProductsActions {
  const [products, setProducts] = useState<TypesenseProductDocument[]>([]);
  const [found, setFound] = useState(0);
  const [page, setPage] = useState(params.page || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [facetCounts, setFacetCounts] = useState<TypesenseFacetCount[]>([]);
  const [facetUniverse, setFacetUniverse] = useState<TypesenseFacetCount[]>([]);
  const [unfilteredFound, setUnfilteredFound] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingMoreRef = useRef(false);

  // Canal activo: el explícito del caller, o el de la sucursal resuelta
  // (ChannelProvider). Defensivo fuera del provider → cae al fallback de env
  // en la capa de filtros de Typesense.
  const contextChannelId = useChannelSafe()?.config.salesChannelId;
  const salesChannelId = params.salesChannelId ?? contextChannelId;

  const fetchProducts = useCallback(
    async (pageToFetch: number, append: boolean = false) => {
      setIsLoading(true);
      setError(null);

      try {
        // Búsqueda directa a Typesense — sin pasar por el proxy
        const data = await searchProductsFromBrowser({
          ...params,
          salesChannelId,
          page: pageToFetch,
        });

        // Beacon de analytics solo en la carga inicial (página 1, query real)
        if (!append && pageToFetch === 1) {
          const rawQuery = params.q?.trim() || "*";
          if (rawQuery !== "*") {
            trackSearchClient(rawQuery, data.found > 0);
          }
        }

        // Ordenar cada batch para que productos con stock aparezcan primero.
        // Aplicado por batch (no globalmente) para que los ítems ya renderizados
        // no cambien de posición al cargar la siguiente página del infinite scroll.
        const sortByStock = (arr: TypesenseProductDocument[]) =>
          [...arr].sort((a, b) => {
            const aInStock = (a.stock_available ?? 0) > 0;
            const bInStock = (b.stock_available ?? 0) > 0;
            if (aInStock === bInStock) return 0;
            return aInStock ? -1 : 1;
          });

        setProducts((prev) =>
          append
            ? [
                ...prev,
                ...sortByStock(
                  data.products.filter(
                    (p) => !prev.some((existing) => existing.id === p.id),
                  ),
                ),
              ]
            : sortByStock(data.products),
        );
        setFound(data.found);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setFacetCounts(data.facetCounts || []);
        setFacetUniverse(data.facetUniverse || []);
        setUnfilteredFound(data.unfilteredFound ?? null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error fetching products",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [params, salesChannelId],
  );

  const loadMore = useCallback(async () => {
    if (page < totalPages && !isLoading && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      try {
        await fetchProducts(page + 1, true);
      } finally {
        isLoadingMoreRef.current = false;
      }
    }
  }, [page, totalPages, isLoading, fetchProducts]);

  const refresh = useCallback(async () => {
    setProducts([]);
    setPage(1);
    await fetchProducts(1, false);
  }, [fetchProducts]);

  useEffect(() => {
    setProducts([]);
    setPage(1);
    fetchProducts(1, false);
  }, [
    params.q,
    params.sortBy,
    params.category,
    params.categoryNames,
    params.collection,
    params.brand,
    params.family,
    params.tag,
    params.tags,
    params.priceMin,
    params.priceMax,
    params.promotion,
    params.onlyPromotions,
    params.fragancia,
    params.sugerenciaUso,
    params.familiaOlfativa,
    params.advisorSurface,
    params.advisorProductType,
    params.advisorEnvironment,
    params.advisorSpecialUse,
    params.advisorBase,
    salesChannelId,
    params.productIds?.join(","),
    params.limit,
    params.facets,
    params.omitPriceFilter,
  ]);

  return {
    products,
    found,
    page,
    totalPages,
    facetCounts,
    facetUniverse,
    unfilteredFound,
    isLoading,
    error,
    loadMore,
    refresh,
  };
}
