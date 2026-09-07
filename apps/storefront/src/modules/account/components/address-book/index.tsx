import type { HttpTypes } from "@medusajs/types";
import type React from "react";
import EditAddress from "../address-card/edit-address-modal";

type AddressBookProps = {
  googleMapsApiKey: string;
  customer: HttpTypes.StoreCustomer;
  region: HttpTypes.StoreRegion;
};

const AddressBook: React.FC<AddressBookProps> = ({
  googleMapsApiKey,
  customer,
  region,
}) => {
  const addresses = customer.addresses || [];

  if (!addresses.length) {
    return (
      <p className="text-gray-400 text-sm">
        Todavía no tenés direcciones guardadas.
      </p>
    );
  }

  return (
    <div className="w-full">
      <div className="grid gap-6 sm:grid-cols-2">
        {addresses.map((address) => (
          <EditAddress
            address={address}
            googleMapsApiKey={googleMapsApiKey}
            key={address.id}
            region={region}
          />
        ))}
      </div>
    </div>
  );
};

export default AddressBook;
