"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import type { HttpTypes } from "@medusajs/types";
import Checkbox from "@modules/common/components/checkbox";
import FormInput from "@modules/common/components/form-input";
import { mapKeys } from "lodash";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AddressSelect from "../address-select";
import ShippingAddressNewForm from "./new-address-form";

type ShippingAddressProps = {
  googleMapsApiKey: string;
  customer: HttpTypes.StoreCustomer | null;
  cart: HttpTypes.StoreCart | null;
  checked: boolean;
  onChange: () => void;
};

const ShippingAddress = ({
  googleMapsApiKey,
  customer,
  cart,
  checked,
  onChange,
}: ShippingAddressProps) => {
  const [formData, setFormData] = useState<Record<string, string>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code":
      cart?.shipping_address?.country_code ||
      cart?.region?.countries?.[0]?.iso_2 ||
      "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    email: cart?.email || "",
  });

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region],
  );

  const addressesInRegion = useMemo(
    () =>
      customer?.addresses?.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code),
      ),
    [customer?.addresses, countriesInRegion],
  );

  const hasSavedAddresses = customer && (addressesInRegion?.length ?? 0) > 0;

  // Default: show saved addresses picker, NOT the new form
  const [showNewForm, setShowNewForm] = useState(false);

  const setFormAddress = useCallback(
    (address?: HttpTypes.StoreCartAddress, email?: string) => {
      if (address) {
        setFormData((prev) => ({
          ...prev,
          "shipping_address.first_name": address.first_name || "",
          "shipping_address.last_name": address.last_name || "",
          "shipping_address.address_1": address.address_1 || "",
          "shipping_address.company": address.company || "",
          "shipping_address.postal_code": address.postal_code || "",
          "shipping_address.city": address.city || "",
          "shipping_address.country_code": address.country_code || "",
          "shipping_address.province": address.province || "",
          "shipping_address.phone": address.phone || "",
        }));
      }
      if (email) {
        setFormData((prev) => ({ ...prev, email }));
      }
    },
    [],
  );

  useEffect(() => {
    if (cart?.shipping_address) {
      setFormAddress(cart.shipping_address, cart.email);
    }
    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email);
    }
  }, [cart, customer?.email, setFormAddress]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <>
      {/* Saved addresses or new form */}
      {hasSavedAddresses && !showNewForm ? (
        <div className="mb-6">
          <p className="mb-3 text-gray-600 text-sm">
            Elegí o cargá una dirección de envío
          </p>
          <AddressSelect
            addresses={customer.addresses}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("shipping_address.", ""),
              ) as unknown as HttpTypes.StoreCartAddress
            }
            onSelect={(addr, email) => {
              setFormAddress(addr, email);
            }}
          />
          <button
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 font-medium text-[--primary-color] text-sm transition-colors hover:border-[--primary-color] hover:bg-green-50/50"
            onClick={() => setShowNewForm(true)}
            type="button"
          >
            <PlusIcon className="h-4 w-4" />
            Agregar nueva dirección
          </button>
        </div>
      ) : hasSavedAddresses && showNewForm ? (
        <div className="mb-6">
          <button
            className="mb-4 font-medium text-[--primary-color] text-sm hover:underline"
            onClick={() => setShowNewForm(false)}
            type="button"
          >
            ← Usar dirección guardada
          </button>
          <ShippingAddressNewForm
            formData={formData}
            googleMapsApiKey={googleMapsApiKey}
            handleChange={handleChange}
            region={cart?.region}
            setFormData={setFormData}
          />
        </div>
      ) : (
        <div className="mb-6">
          <ShippingAddressNewForm
            formData={formData}
            googleMapsApiKey={googleMapsApiKey}
            handleChange={handleChange}
            region={cart?.region}
            setFormData={setFormData}
          />
        </div>
      )}

      <div className="my-6">
        <Checkbox
          checked={checked}
          data-testid="billing-address-checkbox"
          label="Usar la misma dirección para facturación"
          name="same_as_billing"
          onChange={onChange}
        />
      </div>
      <FormInput
        autoComplete="tel"
        data-testid="shipping-phone-input"
        id="s-phone"
        label="Teléfono"
        name="shipping_address.phone"
        onChange={handleChange}
        placeholder="Ej: +54 9 11 1234-5678"
        type="tel"
        value={formData["shipping_address.phone"]}
      />
      {/* Hidden email field so form submission still works */}
      <input name="email" type="hidden" value={formData.email} />
    </>
  );
};

export default ShippingAddress;
