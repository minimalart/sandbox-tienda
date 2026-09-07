"use client";

import { useCallback, useState } from "react";
import type { HttpTypes } from "@medusajs/types";

export interface UseCustomerState {
  isLoading: boolean;
  error: string | null;
}

export interface UseCustomerActions {
  updateCustomer: (data: Partial<HttpTypes.StoreUpdateCustomer>) => Promise<{
    success: boolean;
    error?: string;
  }>;
  clearError: () => void;
}

export type UseCustomerReturn = UseCustomerState & UseCustomerActions;

const customerApi = {
  async post<T = any>(action: string, data: Record<string, any> = {}): Promise<T> {
    const response = await fetch("/api/store/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  },
};

export function useCustomer(): UseCustomerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCustomer = useCallback(
    async (data: Partial<HttpTypes.StoreUpdateCustomer>) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await customerApi.post("update", { data });

        if (!result.success) {
          setError(result.message || "Error al actualizar");
          return { success: false, error: result.message };
        }

        return { success: true };
      } catch (err: any) {
        const errorMessage = err?.message || "Error de conexión";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    updateCustomer,
    clearError,
  };
}
