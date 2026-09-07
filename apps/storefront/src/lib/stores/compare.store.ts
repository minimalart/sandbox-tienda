import { create } from "zustand";

export type CompareProduct = {
  id: string;
  title: string;
  handle?: string | null;
  thumbnail?: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  sku?: string | null;
};

type CompareState = {
  items: CompareProduct[];
  isLoaded: boolean;
};

type CompareActions = {
  load: () => void;
  addItem: (item: CompareProduct) => void;
  removeItem: (productId: string) => void;
  toggleItem: (item: CompareProduct) => void;
  clear: () => void;
  isInCompare: (productId: string) => boolean;
};

type CompareStore = CompareState & CompareActions;

const COMPARE_STORAGE_KEY = "mercatto-compare-products";
const MAX_COMPARE_ITEMS = 4;

function readStoredItems(): CompareProduct[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is CompareProduct => {
        return Boolean(item?.id && item?.title);
      })
      .slice(0, MAX_COMPARE_ITEMS);
  } catch {
    return [];
  }
}

function writeStoredItems(items: CompareProduct[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    COMPARE_STORAGE_KEY,
    JSON.stringify(items.slice(0, MAX_COMPARE_ITEMS)),
  );
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  items: [],
  isLoaded: false,

  load: () => {
    if (get().isLoaded) return;
    set({ items: readStoredItems(), isLoaded: true });
  },

  addItem: (item) => {
    const currentItems = get().items;
    if (currentItems.some((current) => current.id === item.id)) return;

    const nextItems = [...currentItems, item].slice(0, MAX_COMPARE_ITEMS);
    writeStoredItems(nextItems);
    set({ items: nextItems, isLoaded: true });
  },

  removeItem: (productId) => {
    const nextItems = get().items.filter((item) => item.id !== productId);
    writeStoredItems(nextItems);
    set({ items: nextItems, isLoaded: true });
  },

  toggleItem: (item) => {
    if (get().isInCompare(item.id)) {
      get().removeItem(item.id);
      return;
    }
    get().addItem(item);
  },

  clear: () => {
    writeStoredItems([]);
    set({ items: [], isLoaded: true });
  },

  isInCompare: (productId) => {
    return get().items.some((item) => item.id === productId);
  },
}));
