import { MapPinIcon } from "@heroicons/react/24/outline";
import compareAddresses from "@lib/util/compare-addresses";
import type { HttpTypes } from "@medusajs/types";
import { useMemo } from "react";

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[];
  addressInput: HttpTypes.StoreCartAddress | null;
  onSelect: (
    address: HttpTypes.StoreCartAddress | undefined,
    email?: string
  ) => void;
};

const AddressSelect = ({
  addresses,
  addressInput,
  onSelect,
}: AddressSelectProps) => {
  const handleSelect = (id: string) => {
    const savedAddress = addresses.find((a) => a.id === id);
    if (savedAddress) {
      onSelect(savedAddress as HttpTypes.StoreCartAddress);
    }
  };

  const selectedAddress = useMemo(
    () => addresses.find((a) => compareAddresses(a, addressInput)),
    [addresses, addressInput]
  );

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      data-testid="shipping-address-options"
    >
      {addresses.map((address) => {
        const isSelected = selectedAddress?.id === address.id;
        return (
          <button
            className={`relative flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              isSelected
                ? "border-[--primary-color] bg-green-50/50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
            data-testid="shipping-address-option"
            key={address.id}
            onClick={() => handleSelect(address.id)}
            type="button"
          >
            <div className="flex-shrink-0 pt-0.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                  isSelected
                    ? "border-[--primary-color] bg-[--primary-color]"
                    : "border-gray-300 bg-white"
                }`}
              >
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 text-sm">
                {address.first_name} {address.last_name}
              </p>
              {address.company && (
                <p className="text-gray-500 text-xs">{address.company}</p>
              )}
              <div className="mt-1 space-y-0.5 text-gray-600 text-sm">
                <p>
                  {address.address_1}
                  {address.address_2 && <span>, {address.address_2}</span>}
                </p>
                <p>
                  {address.postal_code}, {address.city}
                </p>
                {address.province && <p>{address.province}</p>}
              </div>
              {address.phone && (
                <p className="mt-1 text-gray-400 text-xs">{address.phone}</p>
              )}
            </div>
            <MapPinIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
          </button>
        );
      })}
    </div>
  );
};

export default AddressSelect;
