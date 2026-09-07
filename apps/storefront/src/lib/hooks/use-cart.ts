"use client";

import { useCartStore } from "@lib/stores";
import type { HttpTypes } from "@medusajs/types";
import { useCallback, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

export interface CartAddress {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  company?: string;
  postal_code: string;
  city: string;
  country_code: string;
  province?: string;
  phone?: string;
}

export interface UseCartState {
  cart: HttpTypes.StoreCart | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseCartActions {
  fetchCart: () => Promise<HttpTypes.StoreCart | null>;
  addItem: (variantId: string, quantity: number, countryCode: string) => Promise<boolean>;
  updateItem: (lineId: string, quantity: number) => Promise<boolean>;
  removeItem: (lineId: string) => Promise<boolean>;
  updateAddresses: (data: {
    shipping_address: CartAddress;
    billing_address?: CartAddress;
    email?: string;
  }) => Promise<boolean>;
  setShippingMethod: (shippingMethodId: string) => Promise<boolean>;
  initiatePayment: (providerId: string) => Promise<boolean>;
  placeOrder: () => Promise<{ success: boolean; redirectUrl?: string; error?: string }>;
  applyPromotion: (code: string) => Promise<boolean>;
  clearError: () => void;
}

export type UseCartReturn = UseCartState & UseCartActions;

// ============================================================================
// API HELPERS
// ============================================================================

const cartApi = {
  async fetch(): Promise<{ cart: HttpTypes.StoreCart | null }> {
    const response = await fetch("/api/store/cart");
    return response.json();
  },

  async post<T = any>(action: string, data: Record<string, any> = {}): Promise<T> {
    const response = await fetch("/api/store/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  },
};

// ============================================================================
// HOOK
// ============================================================================

export function useCart(initialCart?: HttpTypes.StoreCart | null): UseCartReturn {
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(initialCart || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { cart: fetchedCart } = await cartApi.fetch();
      setCart(fetchedCart);
      // Debug: Log cart API response
      if (typeof window !== "undefined") {
        console.log("[useCart] Cart API Response:", fetchedCart);
      }
      return fetchedCart;
    } catch (err: any) {
      setError(err.message || "Error al obtener el carrito");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addItem = useCallback(async (variantId: string, quantity: number, countryCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("add", { variantId, quantity, countryCode });
      
      if (result.success && result.cart) {
        setCart(result.cart);
        return true;
      }
      
      setError(result.message || "Error al agregar al carrito");
      return false;
    } catch (err: any) {
      setError(err.message || "Error al agregar al carrito");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateItem = useCallback(async (lineId: string, quantity: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("update", { lineId, quantity });
      
      if (result.success && result.cart) {
        setCart(result.cart);
        return true;
      }
      
      setError(result.message || "Error al actualizar el carrito");
      return false;
    } catch (err: any) {
      setError(err.message || "Error al actualizar el carrito");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (lineId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("delete", { lineId });
      
      if (result.success && result.cart) {
        setCart(result.cart);
        return true;
      }
      
      setError(result.message || "Error al eliminar del carrito");
      return false;
    } catch (err: any) {
      setError(err.message || "Error al eliminar del carrito");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateAddresses = useCallback(async (data: {
    shipping_address: CartAddress;
    billing_address?: CartAddress;
    email?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("updateAddresses", data);
      
      if (result.success && result.cart) {
        setCart(result.cart);
        return true;
      }
      
      setError(result.message || "Error al guardar las direcciones");
      return false;
    } catch (err: any) {
      setError(err.message || "Error al guardar las direcciones");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setShippingMethod = useCallback(async (shippingMethodId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("setShippingMethod", { shippingMethodId });
      
      if (result.success && result.cart) {
        setCart(result.cart);
        return true;
      }
      
      setError(result.message || "Error al seleccionar método de envío");
      return false;
    } catch (err: any) {
      setError(err.message || "Error al seleccionar método de envío");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initiatePayment = useCallback(async (providerId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("initiatePayment", { provider_id: providerId });
      
      if (result.success && result.cart) {
        setCart(result.cart);
        return true;
      }
      
      setError(result.message || "Error al inicializar el pago");
      return false;
    } catch (err: any) {
      setError(err.message || "Error al inicializar el pago");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const placeOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("placeOrder");
      
      if (result.success && result.type === "order") {
        setCart(null);
        // Limpiar el store de Zustand también
        const clearCart = useCartStore.getState().clearCart;
        clearCart();
        return { success: true, redirectUrl: result.redirectUrl };
      }
      
      const errorMessage = result.message || "Error al completar la orden";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } catch (err: any) {
      const errorMessage = err.message || "Error al completar la orden";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applyPromotion = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await cartApi.post("applyPromotion", { code });
      
      if (result.success && result.cart) {
        setCart(result.cart);
        return true;
      }
      
      const rawMessage: string = result.message || "";
      const translatedMessage = rawMessage.match(/^The promotion code .+ is invalid$/i)
        ? "El código de promoción es inválido"
        : rawMessage || "Código de promoción inválido";
      setError(translatedMessage);
      return false;
    } catch (err: any) {
      setError(err.message || "Error al aplicar promoción");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    cart,
    isLoading,
    error,
    // Actions
    fetchCart,
    addItem,
    updateItem,
    removeItem,
    updateAddresses,
    setShippingMethod,
    initiatePayment,
    placeOrder,
    applyPromotion,
    clearError,
  };
}
