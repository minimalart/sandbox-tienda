"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { resolveAndSetBranch } from "@lib/data/branch";
import { useAddresses } from "@lib/hooks/use-addresses";
import { useGuestCheckoutAddresses } from "@lib/hooks/use-guest-checkout-addresses";
import { useStoreSettings } from "@lib/hooks/use-store-settings";
import {
  areGuestCartAddressesEquivalent,
  type GuestCartAddress,
} from "@lib/util/guest-cart-addresses";
import isAddressComplete from "@lib/util/validate-address";
import type { HttpTypes } from "@medusajs/types";
import type { AddressFormData } from "@modules/common/components/address-form-with-map";
import AddressFormWithMap from "@modules/common/components/address-form-with-map";
import { useSearchParams } from "next/navigation";
import { goToCheckoutStep } from "@lib/util/checkout-step";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorMessage from "../error-message";

type AddressValueInput = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  province?: string | null;
  phone?: string | null;
  company?: string | null;
  address_name?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  metadata?: Record<string, unknown> | null;
};

const extractAddressName = (address?: AddressValueInput | null): string => {
  if (!address) return "";
  if (typeof address.address_name === "string" && address.address_name) {
    return address.address_name;
  }
  const meta = address.metadata as
    | { address_name?: string | null }
    | null
    | undefined;
  return typeof meta?.address_name === "string" ? meta.address_name : "";
};

const extractLatLng = (
  address?: AddressValueInput | null,
): { latitude?: string; longitude?: string } => {
  if (!address) return {};
  const meta = address.metadata as
    | { latitude?: string | number; longitude?: string | number }
    | null
    | undefined;
  const lat = address.latitude ?? meta?.latitude;
  const lng = address.longitude ?? meta?.longitude;
  return {
    ...(lat != null && lat !== "" ? { latitude: String(lat) } : {}),
    ...(lng != null && lng !== "" ? { longitude: String(lng) } : {}),
  };
};

const createGuestAddressId = (): string => {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `guest-address-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toAddressValue = (
  address?: AddressValueInput | null,
): GuestCartAddress | null => {
  if (!address?.address_1) {
    return null;
  }

  const coords = extractLatLng(address);
  return {
    id: address.id || "",
    first_name: address.first_name || "",
    last_name: address.last_name || "",
    address_1: address.address_1 || "",
    address_2: address.address_2 || "",
    postal_code: address.postal_code || "",
    city: address.city || "",
    country_code: address.country_code || "",
    province: address.province || "",
    phone: address.phone || "",
    company: address.company || "",
    address_name: extractAddressName(address),
    ...coords,
  };
};

const toCartAddressPayload = (address: GuestCartAddress) => {
  const hasCoords = !!(address.latitude && address.longitude);
  const metadata: Record<string, string> = {};
  if (hasCoords) {
    metadata.latitude = address.latitude as string;
    metadata.longitude = address.longitude as string;
  }
  if (address.address_name) {
    metadata.address_name = address.address_name;
  }
  return {
    first_name: address.first_name,
    last_name: address.last_name,
    address_1: address.address_1,
    address_2: address.address_2,
    postal_code: address.postal_code,
    city: address.city,
    country_code: address.country_code,
    province: address.province,
    phone: address.phone,
    company: address.company,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
};

const Addresses = ({
  googleMapsApiKey,
  cart,
  customer,
  onCartUpdate,
}: {
  googleMapsApiKey: string;
  cart: HttpTypes.StoreCart | null;
  customer: HttpTypes.StoreCustomer | null;
  onCartUpdate?: (
    cart?: HttpTypes.StoreCart | null,
  ) => Promise<HttpTypes.StoreCart | null>;
}) => {
  const searchParams = useSearchParams();
  const {
    multi_branch_enabled: multiBranchEnabled,
    require_branch_coverage: requireBranchCoverage,
  } = useStoreSettings();

  const hasCompleteAddress = useMemo(
    () => isAddressComplete(cart?.shipping_address),
    [cart?.shipping_address],
  );

  const isOpen = searchParams.get("step")?.replace(/^edit-/, '') === "address" || !hasCompleteAddress;

  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [editingGuestAddress, setEditingGuestAddress] =
    useState<GuestCartAddress | null>(null);
  const [editingCustomerAddress, setEditingCustomerAddress] =
    useState<HttpTypes.StoreCustomerAddress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    updateAddress: updateCustomerAddress,
    deleteAddress: deleteCustomerAddress,
    isLoading: isCustomerAddressLoading,
  } = useAddresses();

  // Selected address (either from saved or just created via modal)
  const [selectedCustomerAddress, setSelectedCustomerAddress] =
    useState<GuestCartAddress | null>(() =>
      toAddressValue(cart?.shipping_address),
    );

  const {
    addresses: guestAddresses,
    selectedAddress: selectedGuestAddress,
    isLoading: isGuestAddressesLoading,
    error: guestAddressesError,
    addAddress: addGuestAddress,
    selectAddress: selectGuestAddress,
    removeAddress: removeGuestAddress,
    clearError: clearGuestAddressesError,
  } = useGuestCheckoutAddresses({
    cart,
    enabled: !customer,
    onCartUpdate,
  });

  const savedAddresses = useMemo(() => {
    const countriesInRegion =
      cart?.region?.countries?.map((c) => c.iso_2) ?? [];
    return (
      customer?.addresses?.filter(
        (a) => a.country_code && countriesInRegion.includes(a.country_code),
      ) ?? []
    );
  }, [customer?.addresses, cart?.region]);

  const guestAddressesInRegion = useMemo(() => {
    const countriesInRegion =
      cart?.region?.countries?.map((country) => country.iso_2) ?? [];

    return guestAddresses.filter((address) =>
      countriesInRegion.includes(address.country_code),
    );
  }, [guestAddresses, cart?.region]);

  const selected = customer ? selectedCustomerAddress : selectedGuestAddress;

  useEffect(() => {
    if (!customer) {
      return;
    }

    setSelectedCustomerAddress(toAddressValue(cart?.shipping_address));
  }, [customer, cart?.shipping_address]);

  const selectSavedAddress = useCallback(
    (addr: HttpTypes.StoreCustomerAddress) => {
      setSelectedCustomerAddress(toAddressValue(addr));
    },
    [],
  );

  const handleGuestAddressSelect = useCallback(
    async (addressId: string) => {
      clearGuestAddressesError();
      setError(null);
      await selectGuestAddress(addressId);
    },
    [clearGuestAddressesError, selectGuestAddress],
  );

  const handleGuestAddressEdit = useCallback(
    (address: GuestCartAddress) => {
      setFormError(null);
      setError(null);
      clearGuestAddressesError();
      setEditingGuestAddress(address);
      setEditingCustomerAddress(null);
      setModalOpen(true);
    },
    [clearGuestAddressesError],
  );

  const handleCustomerAddressEdit = useCallback(
    (addr: HttpTypes.StoreCustomerAddress) => {
      setFormError(null);
      setError(null);
      setEditingGuestAddress(null);
      setEditingCustomerAddress(addr);
      setModalOpen(true);
    },
    [],
  );

  const handleCustomerAddressRemove = useCallback(
    async (addressId: string) => {
      setError(null);
      const result = await deleteCustomerAddress(addressId);
      if (result.success) {
        window.location.reload();
      } else {
        setError(result.error || "No se pudo eliminar la dirección");
      }
    },
    [deleteCustomerAddress],
  );

  const handleGuestAddressRemove = useCallback(
    async (addressId: string) => {
      clearGuestAddressesError();
      setFormError(null);
      setError(null);
      await removeGuestAddress(addressId);
    },
    [clearGuestAddressesError, removeGuestAddress],
  );

  const handleModalSubmit = useCallback(
    async (data: AddressFormData) => {
      const addr: GuestCartAddress = {
        id: editingGuestAddress?.id || createGuestAddressId(),
        first_name:
          data.firstName ||
          customer?.first_name ||
          cart?.shipping_address?.first_name ||
          "",
        last_name:
          data.lastName ||
          customer?.last_name ||
          cart?.shipping_address?.last_name ||
          "",
        address_1: data.address1,
        address_2: data.address2 || "",
        postal_code: data.postalCode,
        city: data.city,
        country_code: data.countryCode,
        province: data.province,
        phone: data.phone,
        company: "",
        address_name: data.addressName || "",
        ...(data.latitude != null ? { latitude: String(data.latitude) } : {}),
        ...(data.longitude != null
          ? { longitude: String(data.longitude) }
          : {}),
      };

      setFormError(null);
      setError(null);
      setIsSavingAddress(true);

      try {
        if (!customer) {
          clearGuestAddressesError();
          const addressAdded = await addGuestAddress(addr);

          if (!addressAdded) {
            setFormError("No se pudo guardar la dirección");
            return;
          }

          setModalOpen(false);
          setEditingGuestAddress(null);
          return;
        }

        if (editingCustomerAddress) {
          const result = await updateCustomerAddress(
            editingCustomerAddress.id,
            {
              first_name: addr.first_name,
              last_name: addr.last_name,
              address_1: addr.address_1,
              address_2: addr.address_2 || "",
              city: addr.city,
              postal_code: addr.postal_code,
              province: addr.province,
              country_code: addr.country_code,
              phone: addr.phone,
              address_name: addr.address_name,
              metadata: {
                ...(data.latitude != null && data.longitude != null
                  ? {
                      latitude: String(data.latitude),
                      longitude: String(data.longitude),
                    }
                  : {}),
                ...(addr.address_name
                  ? { address_name: addr.address_name }
                  : {}),
              },
            },
          );

          if (result.success) {
            setModalOpen(false);
            setEditingCustomerAddress(null);
            window.location.reload();
          } else {
            setFormError(result.error || "No se pudo actualizar la dirección");
          }
          return;
        }

        const response = await fetch("/api/store/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            address: {
              first_name: addr.first_name,
              last_name: addr.last_name,
              address_1: addr.address_1,
              address_2: addr.address_2,
              city: addr.city,
              postal_code: addr.postal_code,
              province: addr.province,
              country_code: addr.country_code,
              phone: addr.phone,
              address_name: addr.address_name,
              is_default_shipping: (customer.addresses?.length ?? 0) === 0,
              metadata: {
                ...(data.latitude != null && data.longitude != null
                  ? {
                      latitude: String(data.latitude),
                      longitude: String(data.longitude),
                    }
                  : {}),
                ...(addr.address_name
                  ? { address_name: addr.address_name }
                  : {}),
              },
            },
          }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!(response.ok && result.success)) {
          setFormError(result.message || "No se pudo guardar la dirección");
          return;
        }

        setSelectedCustomerAddress(addr);
        setModalOpen(false);
        setEditingGuestAddress(null);
        setEditingCustomerAddress(null);
      } catch {
        setFormError("No se pudo guardar la dirección");
      } finally {
        setIsSavingAddress(false);
      }
    },
    [
      addGuestAddress,
      clearGuestAddressesError,
      customer,
      editingGuestAddress,
      editingCustomerAddress,
      updateCustomerAddress,
    ],
  );

  const handleContinue = async () => {
    if (!selected) {
      setError("Seleccioná o agregá una dirección de envío");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const email = cart?.email || customer?.email || "";
      const firstName =
        selected.first_name ||
        customer?.first_name ||
        cart?.shipping_address?.first_name ||
        email.split("@")[0] ||
        "Cliente";
      const lastName =
        selected.last_name ||
        customer?.last_name ||
        cart?.shipping_address?.last_name ||
        ".";
      const shipping_address = {
        ...toCartAddressPayload(selected),
        first_name: firstName,
        last_name: lastName,
      };
      const billing_address = { ...shipping_address };

      const shipping_coords =
        selected.latitude && selected.longitude
          ? { latitude: selected.latitude, longitude: selected.longitude }
          : undefined;

      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateAddresses",
          shipping_address,
          billing_address,
          email,
          shipping_coords,
        }),
      });

      const result = await response.json();

      if (!(response.ok && result.success)) {
        setError(result.message || "Error al guardar la dirección");
        setIsSubmitting(false);
        return;
      }

      if (onCartUpdate) {
        const updatedCart = await onCartUpdate(result.cart);
        if (!isAddressComplete(updatedCart?.shipping_address)) {
          setError("No se pudo confirmar la dirección. Intentá de nuevo.");
          setIsSubmitting(false);
          return;
        }
      }

      // Resolver la sucursal por la dirección (polígonos): cambia el canal
      // activo y habilita el cobro por sucursal. No bloqueante: si la dirección
      // no cae en ninguna cobertura, se continúa con el canal por defecto (no
      // rompe el checkout cuando todavía no hay polígonos cargados).
      // Resolución de sucursal solo en modo multi-sucursal (con un solo canal
      // es un no-op: no se llama al backend ni se cambia nada).
      if (multiBranchEnabled) {
        if (shipping_coords?.latitude && shipping_coords?.longitude) {
          try {
            const resolution = await resolveAndSetBranch(
              shipping_coords.latitude,
              shipping_coords.longitude,
            );
            if (requireBranchCoverage && !resolution.covered) {
              setError(
                "Todavía no tenemos cobertura de envío para esta dirección.",
              );
              setIsSubmitting(false);
              return;
            }
          } catch (branchErr) {
            console.error(
              "[checkout] branch resolution failed (non-blocking):",
              branchErr,
            );
          }
        } else if (requireBranchCoverage) {
          // Strict mode needs coordinates — ask for a mapped address.
          setError(
            "Elegí tu dirección desde el buscador del mapa para validar la cobertura.",
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Wait for React to process the cart state update before navigating
      await new Promise((resolve) => setTimeout(resolve, 50));
      goToCheckoutStep("delivery");
      setIsSubmitting(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al guardar la dirección";
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const isSelectedSaved = (addr: HttpTypes.StoreCustomerAddress) =>
    areGuestCartAddressesEquivalent(selected, addr);

  const isSelectedGuest = (addr: GuestCartAddress) =>
    (selected?.id ? selected.id === addr.id : false) ||
    areGuestCartAddressesEquivalent(selected, addr);

  if (!isOpen) {
    return null;
  }

  return (
    <div>
      {/* Saved addresses */}
      {savedAddresses.length > 0 && (
        <div className="mb-4">
          <p className="mb-3 text-gray-600 text-sm">
            Elegí una dirección guardada
          </p>
          <div className="flex flex-col gap-3">
            {savedAddresses.map((addr) => {
              const active = isSelectedSaved(addr);
              return (
                <div
                  className={`relative flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    active
                      ? "border-[--primary-color] bg-[--primary-soft-bg]"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                  key={addr.id}
                >
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                    <button
                      className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSavingAddress || isCustomerAddressLoading}
                      onClick={() => handleCustomerAddressEdit(addr)}
                      type="button"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSavingAddress || isCustomerAddressLoading}
                      onClick={() => handleCustomerAddressRemove(addr.id)}
                      type="button"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    className="flex w-full items-start text-left disabled:cursor-not-allowed"
                    disabled={isSavingAddress || isCustomerAddressLoading}
                    onClick={() => selectSavedAddress(addr)}
                    type="button"
                  >
                    <div className="min-w-0 flex-1 pr-20">
                      <p className="font-semibold text-[--text-dark] text-sm">
                        {extractAddressName(addr as AddressValueInput) ||
                          `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim()}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[--label-color] text-sm">
                        <p>
                          {addr.address_1}
                          {addr.address_2 ? `, ${addr.address_2}` : ""}
                        </p>
                        <p>
                          {addr.postal_code}, {addr.city}
                        </p>
                        {addr.province && <p>{addr.province}</p>}
                      </div>
                      {addr.phone && (
                        <p className="mt-1 text-[--icon-muted] text-xs">
                          {addr.phone}
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!customer && guestAddressesInRegion.length > 0 && (
        <div className="mb-4">
          <p className="mb-3 text-gray-600 text-sm">
            Elegí una dirección guardada
          </p>
          <div className="flex flex-col gap-3">
            {guestAddressesInRegion.map((addr) => {
              const active = isSelectedGuest(addr);
              return (
                <div
                  className={`relative flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    active
                      ? "border-[--primary-color] bg-[--primary-soft-bg]"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                  key={addr.id}
                >
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                    <button
                      className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSavingAddress || isGuestAddressesLoading}
                      onClick={() => handleGuestAddressEdit(addr)}
                      type="button"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSavingAddress || isGuestAddressesLoading}
                      onClick={() => handleGuestAddressRemove(addr.id)}
                      type="button"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    className="flex w-full items-start text-left disabled:cursor-not-allowed"
                    disabled={isSavingAddress || isGuestAddressesLoading}
                    onClick={() => handleGuestAddressSelect(addr.id)}
                    type="button"
                  >
                    <div className="min-w-0 flex-1 pr-16">
                      <p className="font-semibold text-[--text-dark] text-sm">
                        {addr.address_name ||
                          `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim()}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[--label-color] text-sm">
                        <p>
                          {addr.address_1}
                          {addr.address_2 ? `, ${addr.address_2}` : ""}
                        </p>
                        <p>
                          {addr.postal_code}, {addr.city}
                        </p>
                        {addr.province && <p>{addr.province}</p>}
                      </div>
                      {addr.phone && (
                        <p className="mt-1 text-[--icon-muted] text-xs">
                          {addr.phone}
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New address from modal (not saved, just selected) */}
      {selected &&
        ((customer && !savedAddresses.some((a) => isSelectedSaved(a))) ||
          (!customer && guestAddressesInRegion.length === 0)) && (
          <div className="mb-4 w-full rounded-xl border-2 border-[--primary-color] bg-[--primary-soft-bg] p-4">
            <p className="font-semibold text-[--text-dark] text-sm">
              {selected.address_name ||
                `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim()}
            </p>
            <p className="text-[--label-color] text-sm">
              {selected.address_1}
              {selected.address_2 ? `, ${selected.address_2}` : ""}
            </p>
            <p className="text-[--label-color] text-sm">
              {selected.postal_code}, {selected.city}
            </p>
            {selected.phone && (
              <p className="mt-1 text-[--icon-muted] text-xs">
                {selected.phone}
              </p>
            )}
          </div>
        )}

      {/* Add address button */}
      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 border-dashed bg-white px-4 py-4 font-medium text-[--primary-color] text-sm transition-colors hover:border-[--primary-color] hover:bg-green-50/30"
        disabled={isSavingAddress}
        onClick={() => {
          setFormError(null);
          clearGuestAddressesError();
          setEditingGuestAddress(null);
          setModalOpen(true);
        }}
        type="button"
      >
        <PlusIcon className="h-5 w-5" />
        Agregar dirección
      </button>

      {/* Continue button */}
      <button
        className="mt-6 w-full rounded-lg bg-[--primary-color] px-4 py-3 font-medium text-base text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="submit-address-button"
        disabled={
          isSavingAddress ||
          isSubmitting ||
          isGuestAddressesLoading ||
          !selected
        }
        onClick={handleContinue}
        type="button"
      >
        {isSubmitting ? "Procesando..." : "Continuar con el envío"}
      </button>
      <ErrorMessage
        data-testid="address-error-message"
        error={error || guestAddressesError}
      />

      {/* Modal with AddressFormWithMap */}
      <Dialog
        className="relative z-[10000]"
        onClose={() => {
          if (!isSavingAddress && !isCustomerAddressLoading) {
            setModalOpen(false);
            setEditingGuestAddress(null);
            setEditingCustomerAddress(null);
          }
        }}
        open={modalOpen}
      >
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in"
          transition
        />
        <div className="fixed inset-0 z-[10000] w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel
              className="relative w-full max-w-none transform rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl sm:rounded-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
              transition
            >
              <DialogTitle
                as="h3"
                className="mb-4 text-center font-semibold text-gray-900 text-lg"
              >
                {editingGuestAddress || editingCustomerAddress
                  ? "Editar dirección de envío"
                  : "Agregar dirección de envío"}
              </DialogTitle>
              <AddressFormWithMap
                error={formError || guestAddressesError}
                googleMapsApiKey={googleMapsApiKey}
                hideNameFields
                key={
                  editingGuestAddress?.id ||
                  editingCustomerAddress?.id ||
                  "new-address"
                }
                initialData={{
                  firstName:
                    editingGuestAddress?.first_name ||
                    editingCustomerAddress?.first_name ||
                    customer?.first_name ||
                    cart?.shipping_address?.first_name ||
                    "",
                  lastName:
                    editingGuestAddress?.last_name ||
                    editingCustomerAddress?.last_name ||
                    customer?.last_name ||
                    cart?.shipping_address?.last_name ||
                    "",
                  addressName:
                    editingGuestAddress?.address_name ||
                    extractAddressName(
                      editingCustomerAddress as AddressValueInput | null,
                    ) ||
                    "",
                  address1:
                    editingGuestAddress?.address_1 ||
                    editingCustomerAddress?.address_1 ||
                    "",
                  address2:
                    editingGuestAddress?.address_2 ||
                    editingCustomerAddress?.address_2 ||
                    "",
                  city:
                    editingGuestAddress?.city ||
                    editingCustomerAddress?.city ||
                    "",
                  province:
                    editingGuestAddress?.province ||
                    editingCustomerAddress?.province ||
                    "",
                  postalCode:
                    editingGuestAddress?.postal_code ||
                    editingCustomerAddress?.postal_code ||
                    "",
                  countryCode:
                    editingGuestAddress?.country_code ||
                    editingCustomerAddress?.country_code ||
                    cart?.region?.countries?.[0]?.iso_2 ||
                    "ar",
                  phone:
                    editingGuestAddress?.phone ||
                    editingCustomerAddress?.phone ||
                    "",
                }}
                isLoading={isSavingAddress || isCustomerAddressLoading}
                onCancel={() => {
                  if (!isSavingAddress && !isCustomerAddressLoading) {
                    setModalOpen(false);
                    setEditingGuestAddress(null);
                    setEditingCustomerAddress(null);
                  }
                }}
                onSubmit={handleModalSubmit}
                submitLabel={
                  editingGuestAddress || editingCustomerAddress
                    ? "Guardar cambios"
                    : "Usar esta dirección"
                }
              />
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Addresses;
