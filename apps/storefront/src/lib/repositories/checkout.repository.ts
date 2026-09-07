"use server";

import { sdk } from "@lib/config";
import type { HttpTypes } from "@medusajs/types";
import { getAuthHeaders, getCartId } from "@lib/data/cookies";

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

export interface ShippingCoverage {
  evaluated: boolean;
  covered: boolean;
}

export interface ShippingOptionsResult {
  success: boolean;
  shipping_options: HttpTypes.StoreCartShippingOption[];
  // Opcional: backends viejos o feature apagada no lo mandan.
  shipping_coverage?: ShippingCoverage;
  error?: string;
}

export interface PaymentProvidersResult {
  success: boolean;
  payment_providers: PaymentProvider[];
  error?: string;
}

// ============================================================================
// CHECKOUT REPOSITORY FUNCTIONS
// ============================================================================

/**
 * Lists available shipping options for the current cart
 */
export async function listShippingOptions(cartId?: string): Promise<ShippingOptionsResult> {
  const id = cartId || (await getCartId());

  if (!id) {
    return { success: false, shipping_options: [], error: "No cart found" };
  }

  const headers = await getAuthHeaders();

  try {
    const response = await sdk.client.fetch<
      HttpTypes.StoreShippingOptionListResponse & { shipping_coverage?: ShippingCoverage }
    >("/store/shipping-options", {
      method: "GET",
      query: {
        cart_id: id,
        // `+data` es obligatorio — ver la nota en lib/data/fulfillment.ts.
        // La Store API no devuelve `data` por defecto, y sin él
        // isStorePickupOption() (data.pickup_kind === 'store') es siempre
        // false y el paso de envío queda trabado en los retiros en tienda.
        fields: "+data,+service_zone.fulfillment_set.type,*service_zone.fulfillment_set.location.address",
      },
      headers,
      cache: "no-store",
    });

    return {
      success: true,
      shipping_options: response.shipping_options || [],
      shipping_coverage: response.shipping_coverage,
    };
  } catch (error: any) {
    return {
      success: false,
      shipping_options: [],
      error: error.message || "Error fetching shipping options",
    };
  }
}

/**
 * Calculates the price for a specific shipping option
 */
export async function calculateShippingPrice(
  optionId: string,
  cartId?: string,
  data?: Record<string, unknown>
): Promise<{ id: string; amount: number } | null> {
  const id = cartId || (await getCartId());

  if (!id) {
    return null;
  }

  const headers = await getAuthHeaders();

  try {
    const response = await sdk.client.fetch<{
      shipping_option: { id: string; amount: number };
    }>(`/store/shipping-options/${optionId}/calculate`, {
      method: "POST",
      headers,
      body: { cart_id: id, data },
    });

    return {
      id: response.shipping_option.id,
      amount: response.shipping_option.amount,
    };
  } catch {
    return null;
  }
}

/**
 * Lists available payment providers for the current region
 */
export async function listPaymentProviders(regionId: string): Promise<PaymentProvidersResult> {
  const headers = await getAuthHeaders();

  try {
    const response = await sdk.client.fetch<{
      payment_providers: PaymentProvider[];
    }>("/store/payment-providers", {
      method: "GET",
      query: { region_id: regionId },
      headers,
      cache: "no-store",
    });

    return {
      success: true,
      payment_providers: response.payment_providers || [],
    };
  } catch (error: any) {
    return {
      success: false,
      payment_providers: [],
      error: error.message || "Error fetching payment providers",
    };
  }
}
