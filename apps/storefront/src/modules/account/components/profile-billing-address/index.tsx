"use client";

import { useAddresses } from "@lib/hooks/use-addresses";
import type { HttpTypes } from "@medusajs/types";
import Input from "@modules/common/components/input";
import ResponsiveCombobox from "@modules/common/components/responsive-combobox";
import React, { useState, useMemo } from "react";
import AccountInfo from "../account-info";

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer;
  regions: HttpTypes.StoreRegion[];
};

const ProfileBillingAddress: React.FC<MyInformationProps> = ({
  customer,
  regions,
}) => {
  const regionOptions = useMemo(
    () =>
      regions?.flatMap((region) =>
        region.countries?.map((country) => ({
          value: country.iso_2,
          label: country.display_name,
        }))
      ) || [],
    [regions]
  );

  const { addAddress, updateAddress, isLoading, error } = useAddresses();
  const [successState, setSuccessState] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  );
  const [countryCode, setCountryCode] = useState(
    billingAddress?.country_code ?? "",
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSuccessState(false);

    const formData = new FormData(e.currentTarget);
    const addressData = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      company: formData.get("company") as string || "",
      address_1: formData.get("address_1") as string,
      address_2: formData.get("address_2") as string || "",
      city: formData.get("city") as string,
      postal_code: formData.get("postal_code") as string,
      province: formData.get("province") as string || "",
      country_code: formData.get("country_code") as string,
      phone: "",
      is_default_billing: true,
    };

    let result;
    if (billingAddress) {
      result = await updateAddress(billingAddress.id, addressData);
    } else {
      result = await addAddress(addressData);
    }

    if (result.success) {
      setSuccessState(true);
      window.location.reload();
    } else {
      setFormError(result.error || "Error al actualizar");
    }
  };

  const clearState = () => {
    setSuccessState(false);
    setFormError(null);
  };

  const currentInfo = useMemo(() => {
    if (!billingAddress) {
      return "Sin dirección de facturación";
    }

    const country =
      regionOptions?.find(
        (country) => country?.value === billingAddress.country_code
      )?.label || billingAddress.country_code?.toUpperCase();

    return (
      <div className="flex flex-col font-semibold" data-testid="current-info">
        <span>
          {billingAddress.first_name} {billingAddress.last_name}
        </span>
        <span>{billingAddress.company}</span>
        <span>
          {billingAddress.address_1}
          {billingAddress.address_2 ? `, ${billingAddress.address_2}` : ""}
        </span>
        <span>
          {billingAddress.postal_code}, {billingAddress.city}
        </span>
        <span>{country}</span>
      </div>
    );
  }, [billingAddress, regionOptions]);

  return (
    <AccountInfo
      clearState={clearState}
      currentInfo={currentInfo}
      data-testid="account-billing-address-editor"
      isError={!!formError || !!error}
      errorMessage={formError || error || undefined}
      isSuccess={successState}
      isLoading={isLoading}
      label="Dirección de facturación"
      onSubmit={handleSubmit}
    >
        <div className="grid grid-cols-1 gap-y-2">
          <div className="grid grid-cols-2 gap-x-2">
            <Input
              data-testid="billing-first-name-input"
              defaultValue={billingAddress?.first_name || undefined}
              label="Nombre"
              name="first_name"
              placeholder="Ej: Juan"
              required
            />
            <Input
              data-testid="billing-last-name-input"
              defaultValue={billingAddress?.last_name || undefined}
              label="Apellido"
              name="last_name"
              placeholder="Ej: Pérez"
              required
            />
          </div>
          <Input
            data-testid="billing-company-input"
            defaultValue={billingAddress?.company || undefined}
            label="Compañía"
            name="company"
          />
          <Input
            data-testid="billing-address-1-input"
            defaultValue={billingAddress?.address_1 || undefined}
            label="Dirección"
            name="address_1"
            placeholder="Ej: Av. Corrientes 1234"
            required
          />
          <Input
            data-testid="billing-address-2-input"
            defaultValue={billingAddress?.address_2 || undefined}
            label="Departamento, piso, etc."
            name="address_2"
            placeholder="Ej: 3B"
          />
          <div className="grid grid-cols-[144px_1fr] gap-x-2">
            <Input
              data-testid="billing-postcal-code-input"
              defaultValue={billingAddress?.postal_code || undefined}
              label="Código postal"
              name="postal_code"
              placeholder="Ej: 1414"
              required
            />
            <Input
              data-testid="billing-city-input"
              defaultValue={billingAddress?.city || undefined}
              label="Ciudad"
              name="city"
              placeholder="Ej: Buenos Aires"
              required
            />
          </div>
          <Input
            data-testid="billing-province-input"
            defaultValue={billingAddress?.province || undefined}
            label="Provincia"
            name="province"
            placeholder="Ej: Buenos Aires"
          />
          <ResponsiveCombobox
            data-testid="billing-country-code-select"
            id="billing-country-code"
            name="country_code"
            onValueChange={setCountryCode}
            placeholder="Seleccionar país"
            required
            searchPlaceholder="Buscar país..."
            value={countryCode}
            options={[
              { value: "", label: "-" },
              ...regionOptions.map((option) => ({
                value: option?.value ?? "",
                label: option?.label ?? "",
              })),
            ]}
          />
        </div>
    </AccountInfo>
  );
};

export default ProfileBillingAddress;
