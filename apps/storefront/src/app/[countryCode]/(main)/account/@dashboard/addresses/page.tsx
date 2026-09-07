import { retrieveCustomer } from "@lib/data/customer";
import { getRegion } from "@lib/data/regions";
import AddAddress from "@modules/account/components/address-card/add-address";
import AddressBook from "@modules/account/components/address-book";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Mis direcciones",
  description: "Gestioná tus direcciones guardadas.",
};

export default async function Addresses(props: {
  params: Promise<{ countryCode: string }>;
}) {
  const params = await props.params;
  const { countryCode } = params;
  const customer = await retrieveCustomer();
  const region = await getRegion(countryCode);

  if (!(customer && region)) {
    notFound();
  }

  return (
    <div className="space-y-12" data-testid="addresses-page-wrapper">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base/7 text-gray-900">
              Direcciones de envío
            </h2>
            <p className="mt-1 text-gray-500 text-sm/6">
              Añadí, editá o eliminá tus direcciones guardadas. Las vas a poder
              usar rápidamente durante el checkout.
            </p>
          </div>
          <AddAddress
            addresses={customer.addresses || []}
            customer={customer}
            googleMapsApiKey={process.env.GOOGLE_MAPS_API_KEY ?? ""}
            region={region}
          />
        </div>
        <div className="mt-6">
          <AddressBook
            customer={customer}
            googleMapsApiKey={process.env.GOOGLE_MAPS_API_KEY ?? ""}
            region={region}
          />
        </div>
      </div>
    </div>
  );
}
