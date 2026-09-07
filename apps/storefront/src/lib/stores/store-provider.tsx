"use client";

import type { HttpTypes } from "@medusajs/types";
import { useEffect, useRef } from "react";
import { useCartStore } from "./cart.store";

interface StoreProviderProps {
  children: React.ReactNode;
  cart?: HttpTypes.StoreCart | null;
}

/**
 * Provider para hidratar los stores de Zustand con datos del servidor.
 * Debe envolver la aplicación en el layout principal.
 */
export function StoreProvider({ children, cart }: StoreProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // Solo hidratar una vez al montar
    if (initialized.current) return;
    initialized.current = true;

    const { hydrate, fetchCart, isHydrated } = useCartStore.getState();

    if (cart) {
      hydrate(cart);
    } else if (!isHydrated) {
      // Si no hay cart del servidor, fetch desde el cliente
      fetchCart();
    }
  }, []); // Sin dependencias - solo ejecutar una vez

  // Re-fetch cart when tab becomes visible to keep state in sync across tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const { fetchCart, pendingAdditions, pendingQuantityUpdates } =
          useCartStore.getState();
        // Skip if local optimistic operations are pending to avoid clobbering
        if (pendingAdditions.size === 0 && pendingQuantityUpdates.size === 0) {
          fetchCart();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return <>{children}</>;
}
