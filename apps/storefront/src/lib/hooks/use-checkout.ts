"use client";

import type { HttpTypes } from "@medusajs/types";
import { useCallback, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

export interface ShippingOption {
  id: string;
  name: string;
  amount: number;
  price_type: "flat" | "calculated";
  insufficient_inventory?: boolean;
  service_zone?: {
    fulfillment_set?: {
      type?: string;
      location?: {
        address?: HttpTypes.StoreCartAddress;
      };
    };
  };
}

export interface PaymentProvider {
  id: string;
  is_enabled: boolean;
}

export interface UseCheckoutState {
  shippingOptions: HttpTypes.StoreCartShippingOption[];
  paymentProviders: PaymentProvider[];
  isLoadingShipping: boolean;
  isLoadingPayment: boolean;
  error: string | null;
}

export interface UseCheckoutActions {
  fetchShippingOptions: (cartId?: string) => Promise<HttpTypes.StoreCartShippingOption[]>;
  fetchPaymentProviders: (regionId: string) => Promise<PaymentProvider[]>;
  getShippingMethods: () => HttpTypes.StoreCartShippingOption[];
  getPickupMethods: () => HttpTypes.StoreCartShippingOption[];
  clearError: () => void;
}

export type UseCheckoutReturn = UseCheckoutState & UseCheckoutActions;

// ============================================================================
// API HELPERS
// ============================================================================

const checkoutApi = {
  async fetchShippingOptions(cartId?: string): Promise<{ shipping_options: HttpTypes.StoreCartShippingOption[] }> {
    const url = cartId 
      ? `/api/store/shipping-options?cart_id=${cartId}`
      : "/api/store/shipping-options";
    const response = await fetch(url);
    return response.json();
  },

  async fetchPaymentProviders(regionId: string): Promise<{ payment_providers: PaymentProvider[] }> {
    const response = await fetch(`/api/store/payment-providers?region_id=${regionId}`);
    return response.json();
  },
};

// ============================================================================
// HOOK
// ============================================================================

export function useCheckout(): UseCheckoutReturn {
  const [shippingOptions, setShippingOptions] = useState<HttpTypes.StoreCartShippingOption[]>([]);
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchShippingOptions = useCallback(async (cartId?: string) => {
    setIsLoadingShipping(true);
    setError(null);

    try {
      const { shipping_options } = await checkoutApi.fetchShippingOptions(cartId);
      setShippingOptions(shipping_options || []);
      return shipping_options || [];
    } catch (err: any) {
      setError(err.message || "Error al obtener métodos de envío");
      return [];
    } finally {
      setIsLoadingShipping(false);
    }
  }, []);

  const fetchPaymentProviders = useCallback(async (regionId: string) => {
    setIsLoadingPayment(true);
    setError(null);

    try {
      const { payment_providers } = await checkoutApi.fetchPaymentProviders(regionId);
      setPaymentProviders(payment_providers || []);
      return payment_providers || [];
    } catch (err: any) {
      setError(err.message || "Error al obtener métodos de pago");
      return [];
    } finally {
      setIsLoadingPayment(false);
    }
  }, []);

  const getShippingMethods = useCallback(() => {
    return shippingOptions.filter((option) => {
      const fulfillmentSetType = (option as any).service_zone?.fulfillment_set?.type;
      return fulfillmentSetType !== "pickup";
    });
  }, [shippingOptions]);

  const getPickupMethods = useCallback(() => {
    return shippingOptions.filter((option) => {
      const fulfillmentSetType = (option as any).service_zone?.fulfillment_set?.type;
      return fulfillmentSetType === "pickup";
    });
  }, [shippingOptions]);

  return {
    // State
    shippingOptions,
    paymentProviders,
    isLoadingShipping,
    isLoadingPayment,
    error,
    // Actions
    fetchShippingOptions,
    fetchPaymentProviders,
    getShippingMethods,
    getPickupMethods,
    clearError,
  };
}
