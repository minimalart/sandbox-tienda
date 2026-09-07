import { listBillingProfiles } from "@lib/data/billing-profile";
import { retrieveCustomer } from "@lib/data/customer";
import BillingProfilesManager from "@modules/account/components/billing/billing-profiles";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Datos de facturación",
  description: "Gestioná tus perfiles de facturación (Factura A).",
};

export default async function BillingPage() {
  const customer = await retrieveCustomer();
  if (!customer) {
    notFound();
  }

  const profiles = await listBillingProfiles();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">
          Datos de facturación
        </h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Administrá tus perfiles fiscales para pedir Factura A en el checkout.
        </p>
      </div>
      <BillingProfilesManager initialProfiles={profiles} />
    </div>
  );
}
