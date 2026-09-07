"use client";

import { useWishlistStore } from "@lib/stores/wishlist.store";
import { useEffect } from "react";

export type UseWishlistReturn = {
  items: {
    id: string;
    product_id: string;
    product_variant_id: string;
    quantity: number;
  }[];
  isLoaded: boolean;
  isFetching: boolean;
  isInWishlist: (productId: string, variantId: string) => boolean;
  isToggling: (productId: string, variantId: string) => boolean;
  toggleItem: (productId: string, variantId: string) => void;
};

export function useWishlist(): UseWishlistReturn {
  const items = useWishlistStore((state) => state.items);
  const isLoaded = useWishlistStore((state) => state.isLoaded);
  const isFetching = useWishlistStore((state) => state.isFetching);
  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);
  const toggleItem = useWishlistStore((state) => state.toggleItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const isToggling = useWishlistStore((state) => state.isToggling);

  useEffect(() => {
    if (!isLoaded && !isFetching) {
      fetchWishlist();
    }
  }, [fetchWishlist, isFetching, isLoaded]);

  return {
    items,
    isLoaded,
    isFetching,
    isInWishlist,
    isToggling,
    toggleItem,
  };
}
