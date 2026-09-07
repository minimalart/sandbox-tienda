"use client";

import { useCartStore } from "@lib/stores";
import type { HttpTypes } from "@medusajs/types";
import { useEffect } from "react";

/**
 * Hook para sincronizar el carrito con el store de Zustand.
 * Úsalo en componentes que reciben el cart como prop del servidor.
 */
export function useCartSync(cart: HttpTypes.StoreCart | null | undefined) {
  const setCart = useCartStore((state) => state.setCart);

  useEffect(() => {
    if (cart) {
      setCart(cart);
    }
  }, [cart, setCart]);
}

/**
 * Hook para actualizar el carrito después de una acción.
 * Retorna una función que actualiza el store con el nuevo cart.
 */
export function useCartUpdate() {
  const setCart = useCartStore((state) => state.setCart);
  const setLoading = useCartStore((state) => state.setLoading);

  const updateCart = (cart: HttpTypes.StoreCart | null) => {
    setCart(cart);
    setLoading(false);
  };

  const startLoading = () => {
    setLoading(true);
  };

  return { updateCart, startLoading };
}
