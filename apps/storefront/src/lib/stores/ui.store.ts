import { create } from "zustand";

interface UIState {
  // Modales
  isSearchOpen: boolean;
  isMobileMenuOpen: boolean;
  isMobileFiltersOpen: boolean;
  isQuickViewOpen: boolean;

  // Acciones - Search
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;

  // Acciones - Quick View
  openQuickView: () => void;
  closeQuickView: () => void;

  // Acciones - Mobile Menu
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleMobileMenu: () => void;

  // Acciones - Mobile Filters
  openMobileFilters: () => void;
  closeMobileFilters: () => void;
  toggleMobileFilters: () => void;

  // Cerrar todo
  closeAll: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  // Estado inicial
  isSearchOpen: false,
  isMobileMenuOpen: false,
  isMobileFiltersOpen: false,
  isQuickViewOpen: false,

  // Acciones - Search
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

  // Acciones - Quick View
  openQuickView: () => set({ isQuickViewOpen: true }),
  closeQuickView: () => set({ isQuickViewOpen: false }),

  // Acciones - Mobile Menu
  openMobileMenu: () => set({ isMobileMenuOpen: true }),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

  // Acciones - Mobile Filters
  openMobileFilters: () => set({ isMobileFiltersOpen: true }),
  closeMobileFilters: () => set({ isMobileFiltersOpen: false }),
  toggleMobileFilters: () =>
    set((state) => ({ isMobileFiltersOpen: !state.isMobileFiltersOpen })),

  // Cerrar todo
  closeAll: () =>
    set({
      isSearchOpen: false,
      isMobileMenuOpen: false,
      isMobileFiltersOpen: false,
      isQuickViewOpen: false,
    }),
}));
