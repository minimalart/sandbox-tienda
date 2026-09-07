"use client";

import type { HttpTypes } from "@medusajs/types";
import {
  findMatchingGuestCartAddress,
  parseGuestCartAddressesMetadata,
  type GuestCartAddress,
} from "@lib/util/guest-cart-addresses";
import { useCallback, useEffect, useMemo, useState } from "react";

type CartActionResponse = {
  cart: HttpTypes.StoreCart | null;
  success?: boolean;
  message?: string;
};

type UseGuestCheckoutAddressesInput = {
  cart: HttpTypes.StoreCart | null;
  enabled: boolean;
  onCartUpdate?: (cart?: HttpTypes.StoreCart | null) => Promise<HttpTypes.StoreCart | null>;
};

type UseGuestCheckoutAddressesState = {
  addresses: GuestCartAddress[];
  selectedAddress: GuestCartAddress | null;
  isLoading: boolean;
  error: string | null;
};

type UseGuestCheckoutAddressesActions = {
  addAddress: (address: GuestCartAddress) => Promise<boolean>;
  selectAddress: (addressId: string) => Promise<boolean>;
  removeAddress: (addressId: string) => Promise<boolean>;
  clearError: () => void;
};

type UseGuestCheckoutAddressesReturn = UseGuestCheckoutAddressesState &
  UseGuestCheckoutAddressesActions;

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveStateFromCart = (
  cart: HttpTypes.StoreCart | null,
): Pick<UseGuestCheckoutAddressesState, "addresses" | "selectedAddress"> => {
  const metadata = parseGuestCartAddressesMetadata(cart?.metadata);
  const selectedById = metadata.selected_address_id
    ? metadata.addresses.find(
        (address) => address.id === metadata.selected_address_id,
      ) || null
    : null;
  const selectedByShippingAddress = selectedById
    ? null
    : findMatchingGuestCartAddress(
        metadata.addresses,
        cart?.shipping_address || null,
      );

  return {
    addresses: metadata.addresses,
    selectedAddress: selectedById || selectedByShippingAddress,
  };
};

const postCartAction = async (
  action: string,
  payload: Record<string, unknown>,
): Promise<CartActionResponse> => {
  const response = await fetch("/api/store/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  const result = (await response.json()) as CartActionResponse;

  if (!response.ok || !result.success) {
    throw new Error(result.message || "No se pudo actualizar el carrito");
  }

  return result;
};

export function useGuestCheckoutAddresses({
  cart,
  enabled,
  onCartUpdate,
}: UseGuestCheckoutAddressesInput): UseGuestCheckoutAddressesReturn {
  const initialState = useMemo(() => resolveStateFromCart(cart), [cart]);
  const [addresses, setAddresses] = useState<GuestCartAddress[]>(
    initialState.addresses,
  );
  const [selectedAddress, setSelectedAddress] =
    useState<GuestCartAddress | null>(initialState.selectedAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAddresses([]);
      setSelectedAddress(null);
      setError(null);
      return;
    }

    const nextState = resolveStateFromCart(cart);
    setAddresses(nextState.addresses);
    setSelectedAddress(nextState.selectedAddress);
  }, [cart, enabled]);

  const syncFromCart = useCallback(
    async (nextCart: HttpTypes.StoreCart | null) => {
      const updatedCart = onCartUpdate ? await onCartUpdate(nextCart) : nextCart;
      const resolvedState = resolveStateFromCart(updatedCart || nextCart);
      setAddresses(resolvedState.addresses);
      setSelectedAddress(resolvedState.selectedAddress);
    },
    [onCartUpdate],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const addAddress = useCallback(
    async (address: GuestCartAddress) => {
      if (!enabled) {
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await postCartAction("addGuestAddress", { address });
        await syncFromCart(result.cart);
        return true;
      } catch (actionError: unknown) {
        setError(
          getErrorMessage(actionError, "No se pudo guardar la dirección"),
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, syncFromCart],
  );

  const selectAddress = useCallback(
    async (addressId: string) => {
      if (!enabled) {
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await postCartAction("selectGuestAddress", { addressId });
        await syncFromCart(result.cart);
        return true;
      } catch (actionError: unknown) {
        setError(
          getErrorMessage(actionError, "No se pudo seleccionar la dirección"),
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, syncFromCart],
  );

  const removeAddress = useCallback(
    async (addressId: string) => {
      if (!enabled) {
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await postCartAction("removeGuestAddress", { addressId });
        await syncFromCart(result.cart);
        return true;
      } catch (actionError: unknown) {
        setError(
          getErrorMessage(actionError, "No se pudo eliminar la dirección"),
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, syncFromCart],
  );

  return {
    addresses,
    selectedAddress,
    isLoading,
    error,
    addAddress,
    selectAddress,
    removeAddress,
    clearError,
  };
}
