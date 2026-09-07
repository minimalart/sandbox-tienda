"use client";

import { useCallback, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

export interface AddressData {
  first_name: string;
  last_name: string;
  company?: string;
  address_name?: string;
  address_1: string;
  address_2?: string;
  city: string;
  postal_code: string;
  province?: string;
  country_code: string;
  phone?: string;
  is_default_billing?: boolean;
  is_default_shipping?: boolean;
  metadata?: Record<string, string>;
}

export interface UseAddressesState {
  isLoading: boolean;
  error: string | null;
}

export interface UseAddressesActions {
  addAddress: (address: AddressData) => Promise<{ success: boolean; error?: string }>;
  updateAddress: (addressId: string, address: AddressData) => Promise<{ success: boolean; error?: string }>;
  deleteAddress: (addressId: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

export type UseAddressesReturn = UseAddressesState & UseAddressesActions;

// ============================================================================
// API HELPERS
// ============================================================================

const addressesApi = {
  async post<T = any>(action: string, data: Record<string, any> = {}): Promise<T> {
    const response = await fetch("/api/store/addresses", {
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

export function useAddresses(): UseAddressesReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAddress = useCallback(async (address: AddressData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await addressesApi.post("add", { address });
      if (!result.success) {
        setError(result.message || "Error al guardar dirección");
      }
      return { success: result.success, error: result.message };
    } catch (err) {
      const message = "Error de conexión";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateAddress = useCallback(async (addressId: string, address: AddressData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await addressesApi.post("update", { addressId, address });
      if (!result.success) {
        setError(result.message || "Error al actualizar dirección");
      }
      return { success: result.success, error: result.message };
    } catch (err) {
      const message = "Error de conexión";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteAddress = useCallback(async (addressId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await addressesApi.post("delete", { addressId });
      if (!result.success) {
        setError(result.message || "Error al eliminar dirección");
      }
      return { success: result.success, error: result.message };
    } catch (err) {
      const message = "Error de conexión";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    addAddress,
    updateAddress,
    deleteAddress,
    clearError,
  };
}
