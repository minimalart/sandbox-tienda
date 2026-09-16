"use client";

import type { HttpTypes } from "@medusajs/types";
import { useEffect, useRef } from "react";
import { resolveCartHydration } from "./cart-hydration";
import { useCartStore } from "./cart.store";

interface StoreProviderProps {
  children: React.ReactNode;
  cart?: HttpTypes.StoreCart | null;
}

/**
 * Provider para hidratar los stores de Zustand con datos del servidor.
 * Debe envolver la aplicación en el layout principal.
 *
 * Hay un provider por grupo de rutas (`(main)`, `(checkout)`, `(b2b)`), así que
 * al navegar entre grupos se monta uno nuevo. Sólo el PRIMERO de la sesión
 * hidrata con el `cart` del server: los siguientes pueden recibir un carrito
 * viejo del Router Cache y no deben pisar el store (ver `cart-hydration.ts`).
 */
export function StoreProvider({ children, cart }: StoreProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // Solo hidratar una vez al montar
    if (initialized.current) return;
    initialized.current = true;

    const { hydrate, fetchCart, isHydrated, pendingAdditions, pendingQuantityUpdates } =
      useCartStore.getState();

    const decision = resolveCartHydration({
      isHydrated,
      hasServerCart: Boolean(cart),
      hasPendingMutations: pendingAdditions.size > 0 || pendingQuantityUpdates.size > 0,
    });

    switch (decision) {
      case "hydrate-server-cart":
        hydrate(cart ?? null);
        break;
      case "fetch-initial":
      case "reconcile":
        // `fetchCart` ya descarta su respuesta si hubo un cambio optimista
        // mientras estaba en vuelo, así que reconciliar en segundo plano no
        // pisa lo que el usuario esté haciendo.
        fetchCart();
        break;
      case "keep-store":
        break;
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
