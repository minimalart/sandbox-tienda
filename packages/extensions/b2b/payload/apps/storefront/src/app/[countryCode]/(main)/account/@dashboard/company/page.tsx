import { getMyCorporate } from "@lib/data/corporate";
import { retrieveCustomer } from "@lib/data/customer";
import CompanyDashboard from "@modules/account/components/corporate/company-dashboard";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Mi Empresa",
  description: "Gestioná tu cuenta corporativa y empleados.",
};

export default async function CompanyPage() {
  const customer = await retrieveCustomer();
  if (!customer) {
    notFound();
  }

  const data = await getMyCorporate();

  if (!data.corporate) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-semibold text-base/7 text-gray-900">Mi Empresa</h2>
          <p className="mt-1 text-gray-500 text-sm/6">
            Todavía no pertenecés a ninguna empresa.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-gray-600 text-sm">
            Si tu organización compra en cantidad, registrá una cuenta corporativa para
            gestionar empleados, roles y reglas de compra.
          </p>
          <LocalizedClientLink
            className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white"
            href="/corporate/register"
          >
            Registrar mi empresa
          </LocalizedClientLink>
        </div>
      </div>
    );
  }

  return <CompanyDashboard data={data} />;
}
