"use client";

import { useCallback, useState } from "react";
import { type UtmParams, getUtmParams } from "@lib/util/utm";

export type SubscriptionSource =
  | "register"
  | "checkout"
  | "reseller"
  | "academia";

export interface SubscriptionConsentData {
  email: string;
  source: SubscriptionSource;
  tenant_id?: string;
  utm?: UtmParams;
}

export interface UseSubscriptionConsentState {
  isLoading: boolean;
  error: string | null;
}

export interface UseSubscriptionConsentActions {
  recordConsent: (
    data: SubscriptionConsentData,
  ) => Promise<{ success: boolean }>;
}

const consentApi = {
  async post<T>(data: SubscriptionConsentData): Promise<T> {
    const response = await fetch("/api/store/subscription-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },
};

export function useSubscriptionConsent(): UseSubscriptionConsentState &
  UseSubscriptionConsentActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordConsent = useCallback(async (data: SubscriptionConsentData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await consentApi.post<{
        success: boolean;
        message?: string;
      }>({ ...data, utm: getUtmParams() });
      if (!result.success) {
        setError(result.message || "Error al registrar suscripción");
        return { success: false };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de conexión";
      setError(message);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, recordConsent };
}
