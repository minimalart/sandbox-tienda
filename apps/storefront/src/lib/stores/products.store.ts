import type { HttpTypes } from "@medusajs/types";
import { create } from "zustand";

// Tipo de ordenamiento (duplicado para evitar dependencia circular)
type SortOptions = "price_asc" | "price_desc" | "created_at";

interface ProductFilters {
  categoryId?: string;
  collectionId?: string;
  searchQuery?: string;
  sortBy: SortOptions;
}

interface ProductsState {
  // Estado
  products: HttpTypes.StoreProduct[];
  filters: ProductFilters;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;

  // Acciones
  setProducts: (products: HttpTypes.StoreProduct[]) => void;
  addProducts: (products: HttpTypes.StoreProduct[]) => void;
  setFilters: (filters: Partial<ProductFilters>) => void;
  resetFilters: () => void;
  setCurrentPage: (page: number) => void;
  setPagination: (data: { totalPages: number; totalCount: number }) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Helpers
  hasMore: () => boolean;
}

const defaultFilters: ProductFilters = {
  categoryId: undefined,
  collectionId: undefined,
  searchQuery: undefined,
  sortBy: "created_at",
};

export const useProductsStore = create<ProductsState>()((set, get) => ({
  // Estado inicial
  products: [],
  filters: defaultFilters,
  currentPage: 1,
  totalPages: 0,
  totalCount: 0,
  isLoading: false,
  isLoadingMore: false,
  error: null,

  // Acciones
  setProducts: (products) => set({ products }),
  addProducts: (newProducts) =>
    set((state) => {
      const existingIds = new Set(state.products.map((p) => p.id));
      const uniqueNewProducts = newProducts.filter((p) => !existingIds.has(p.id));
      return { products: [...state.products, ...uniqueNewProducts] };
    }),
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1,
      products: [],
    })),
  resetFilters: () =>
    set({
      filters: defaultFilters,
      currentPage: 1,
      products: [],
    }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setPagination: ({ totalPages, totalCount }) =>
    set({ totalPages, totalCount }),
  setLoading: (isLoading) => set({ isLoading }),
  setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),
  setError: (error) => set({ error }),

  // Helpers
  hasMore: () => {
    const { currentPage, totalPages } = get();
    return currentPage < totalPages;
  },
}));
