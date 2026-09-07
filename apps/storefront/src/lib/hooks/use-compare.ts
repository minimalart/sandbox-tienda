"use client";

import {
  type CompareProduct,
  useCompareStore,
} from "@lib/stores/compare.store";
import { useEffect } from "react";

export function useCompare() {
  const items = useCompareStore((state) => state.items);
  const isLoaded = useCompareStore((state) => state.isLoaded);
  const load = useCompareStore((state) => state.load);
  const addItem = useCompareStore((state) => state.addItem);
  const removeItem = useCompareStore((state) => state.removeItem);
  const toggleItem = useCompareStore((state) => state.toggleItem);
  const clear = useCompareStore((state) => state.clear);
  const isInCompare = useCompareStore((state) => state.isInCompare);

  useEffect(() => {
    if (!isLoaded) {
      load();
    }
  }, [isLoaded, load]);

  return {
    items,
    isLoaded,
    addItem,
    removeItem,
    toggleItem,
    clear,
    isInCompare,
  };
}

export type { CompareProduct };
