import type { HttpTypes } from "@medusajs/types";
import FormInput from "@modules/common/components/form-input";
import ResponsiveCombobox from "@modules/common/components/responsive-combobox";
import type React from "react";
import { useState } from "react";

const IC = "h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color]";

const BillingAddress = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [formData, setFormData] = useState<any>({
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.company": cart?.billing_address?.company || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code": cart?.billing_address?.country_code || "",
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": cart?.billing_address?.phone || "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const countries = cart?.region?.countries ?? [];
  const countryOptions =
    countries.length > 0
      ? countries.map((country) => ({
          value: country.iso_2 ?? "",
          label: country.display_name ?? country.iso_2 ?? "",
        }))
      : [{ value: "ar", label: "Argentina" }];

  return (
    <div className="grid grid-cols-2 gap-3">
      <FormInput autoComplete="given-name" data-testid="billing-first-name-input" id="b-first-name" label="Nombre" name="billing_address.first_name" onChange={handleChange} placeholder="Ej: Juan" required type="text" value={formData["billing_address.first_name"]} />
      <FormInput autoComplete="family-name" data-testid="billing-last-name-input" id="b-last-name" label="Apellido" name="billing_address.last_name" onChange={handleChange} placeholder="Ej: Pérez" required type="text" value={formData["billing_address.last_name"]} />
      <FormInput autoComplete="address-line1" className="col-span-2" data-testid="billing-address-input" id="b-addr1" label="Dirección" name="billing_address.address_1" onChange={handleChange} placeholder="Ej: Av. Corrientes 1234" required type="text" value={formData["billing_address.address_1"]} />
      <FormInput autoComplete="postal-code" data-testid="billing-postal-input" id="b-postal" label="Código postal" name="billing_address.postal_code" onChange={handleChange} placeholder="Ej: 1414" required type="text" value={formData["billing_address.postal_code"]} />
      <FormInput autoComplete="address-level2" id="b-city" label="Ciudad" name="billing_address.city" onChange={handleChange} placeholder="Ej: Buenos Aires" type="text" value={formData["billing_address.city"]} />
      <FormInput autoComplete="address-level1" data-testid="billing-province-input" id="b-province" label="Provincia" name="billing_address.province" onChange={handleChange} placeholder="Ej: Buenos Aires" type="text" value={formData["billing_address.province"]} />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600" htmlFor="b-country">País *</label>
        <ResponsiveCombobox
          autoComplete="country"
          data-testid="billing-country-select"
          id="b-country"
          name="billing_address.country_code"
          onValueChange={(value) =>
            setFormData((prev: Record<string, string>) => ({
              ...prev,
              "billing_address.country_code": value,
            }))
          }
          placeholder="Seleccionar país"
          required
          searchPlaceholder="Buscar país..."
          triggerClassName={IC}
          value={formData["billing_address.country_code"]}
          options={countryOptions}
        />
      </div>
      <FormInput autoComplete="tel" data-testid="billing-phone-input" id="b-phone" label="Teléfono" name="billing_address.phone" onChange={handleChange} placeholder="Ej: +54 9 11 1234-5678" type="tel" value={formData["billing_address.phone"]} />
    </div>
  );
};

export default BillingAddress;
