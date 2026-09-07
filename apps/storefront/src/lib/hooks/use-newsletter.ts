"use client";

import { useCallback, useState } from "react";

export interface UseNewsletterState {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
}

export interface UseNewsletterActions {
  subscribe: (email: string) => Promise<{ success: boolean }>;
  reset: () => void;
}

const newsletterApi = {
  async subscribe(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await fetch("/api/store/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return { success: true, message: data.message };
    }

    return { success: false, error: data.error || "Ocurrió un error. Intentá nuevamente." };
  },
};

export function useNewsletter(): UseNewsletterState & UseNewsletterActions {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async (email: string) => {
    if (!email.trim() || isLoading) return { success: false };

    setIsLoading(true);
    setError(null);

    try {
      const result = await newsletterApi.subscribe(email.trim());

      if (result.success) {
        setIsSuccess(true);
        return { success: true };
      }

      setError(result.error || "Ocurrió un error. Intentá nuevamente.");
      return { success: false };
    } catch {
      setError("No se pudo conectar con el servidor. Intentá nuevamente.");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsSuccess(false);
    setError(null);
  }, []);

  return { isLoading, isSuccess, error, subscribe, reset };
}
